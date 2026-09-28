import { apiRequest } from './http'
import { analyzeNote, notifyItemsChanged } from './itemsApi'
import { listNotes } from './notesApi'

export const BACKLOG_STATUSES = ['UNPROCESSED', 'FAILED']

/** Notes that still need AI processing. Pure helper, unit-tested. */
export function backlogNotes(notes) {
  return (notes || []).filter((note) => BACKLOG_STATUSES.includes(note.processingStatus))
}

// Five starts per minute, below the backend's six/minute analyze throttle.
// Providers may impose stricter token/key quotas; those still stop the run.
export const ANALYZE_SPACING_MS = 12000

function waitBetweenNotes(ms, signal) {
  if (signal?.aborted) return Promise.reject(new Error('Analysis cancelled.'))
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error('Analysis cancelled.'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * One HTTP request per note, with a pause between starts. Each success only
 * creates review drafts; no automatic confirmation. A fresh server snapshot
 * supplies revisions and excludes notes already processed in another tab.
 * Rate limits stop immediately rather than spending another trial attempt.
 */
export async function analyzeBacklog(credentials = {}, { signal, onProgress = () => {}, spacingMs = ANALYZE_SPACING_MS, wait = waitBetweenNotes } = {}) {
  const { apiKey = '', trial = false, provider = 'groq' } = credentials
  const candidates = backlogNotes(await listNotes()).filter((note) => !note.isArchived)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id)))
  const results = []
  let stopped = null
  let consecutiveFailures = 0
  onProgress({ current: 0, total: candidates.length, results: [] })
  for (const note of candidates) {
    if (signal?.aborted) { stopped = 'cancelled'; break }
    if (results.length > 0) {
      try { await wait(spacingMs, signal) } catch { stopped = 'cancelled'; break }
    }
    onProgress({ current: results.length + 1, total: candidates.length, results: [...results] })
    try {
      await analyzeNote(note.id, note.revision, apiKey, trial, provider, signal)
      results.push({ id: note.id, status: 'analyzed', code: 'ok' })
      consecutiveFailures = 0
    } catch (error) {
      if (signal?.aborted) { stopped = 'cancelled'; break }
      const code = error?.data?.code || (error?.status === 429 ? 'rate_limit' : 'unexpected')
      if (error?.status === 409) {
        results.push({ id: note.id, status: 'skipped', code: 'changed' })
      } else {
        results.push({ id: note.id, status: 'failed', code })
        consecutiveFailures += 1
      }
      // No immediate automatic retry: a second provider call would spend
      // another free-trial attempt and can worsen the rate limit.
      if (code === 'rate_limit' || code === 'trial_exhausted' || error?.status === 429) {
        stopped = code === 'trial_exhausted' ? 'trial_exhausted' : 'rate_limit'
      } else if (code === 'invalid_key' || code === 'credential_required' || code === 'trial_unavailable') {
        stopped = code
      } else if (consecutiveFailures >= 3) {
        stopped = 'provider_unavailable'
      }
    }
    onProgress({ current: results.length, total: candidates.length, results: [...results] })
    if (stopped) break
  }
  if (stopped) {
    for (const note of candidates.slice(results.length)) {
      results.push({ id: note.id, status: 'skipped', code: stopped })
    }
  }
  return { mode: 'verify', results, stopped }
}

/** Sequentially process the owned backlog. Mode is 'analyze' or 'verify'. */
export async function processAll(mode, credentials = {}, signal) {
  const { apiKey = '', trial = false, provider = 'groq' } = credentials
  const result = await apiRequest('/notes/process-all/', {
    method: 'POST',
    body: JSON.stringify({ mode }),
    headers: { 'X-AI-Provider': provider, ...(apiKey ? { 'X-AI-Api-Key': apiKey } : trial ? { 'X-AI-Trial': 'true' } : {}) },
    signal,
    // A backlog holds the request open across many provider calls.
    timeout: 300000,
  })
  // Bulk runs confirm items server-side but no single-item endpoint runs, so
  // nothing else notifies the shared items cache. Without this, category
  // tabs and Today's tasks stay stale until a hard refresh.
  notifyItemsChanged()
  return result
}

export function getAiEntitlement(signal) {
  return apiRequest('/auth/ai/entitlement/', { signal })
}

/** Collapse a process-all response into counts for display. Pure helper. */
export function summarizeResults(data) {
  const counts = { analyzed: 0, confirmed: 0, failed: 0, skipped: 0 }
  const failures = []
  for (const row of data?.results || []) {
    if (counts[row.status] !== undefined) counts[row.status] += 1
    if (row.status === 'failed') failures.push(row.code)
  }
  return { ...counts, total: (data?.results || []).length, stopped: data?.stopped || null, failures }
}
