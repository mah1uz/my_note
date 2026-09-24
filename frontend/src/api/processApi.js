import { apiRequest } from './http'

export const BACKLOG_STATUSES = ['UNPROCESSED', 'FAILED']

/** Notes that still need AI processing. Pure helper, unit-tested. */
export function backlogNotes(notes) {
  return (notes || []).filter((note) => BACKLOG_STATUSES.includes(note.processingStatus))
}

/** Sequentially process the owned backlog. Mode is 'analyze' or 'verify'. */
export function processAll(mode, credentials = {}, signal) {
  const { apiKey = '', trial = false } = credentials
  return apiRequest('/notes/process-all/', {
    method: 'POST',
    body: JSON.stringify({ mode }),
    headers: apiKey ? { 'X-Groq-Api-Key': apiKey } : trial ? { 'X-Groq-Trial': 'true' } : undefined,
    signal,
    // A backlog holds the request open across many provider calls.
    timeout: 300000,
  })
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
