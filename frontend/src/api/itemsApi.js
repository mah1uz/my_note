import { apiRequest, unwrapPage } from './http'

export const getReview = (noteId) => apiRequest(`/notes/${noteId}/review/`)

export const analyzeNote = (noteId, revision, groqApiKey = '', trial = false) => apiRequest(`/notes/${noteId}/analyze/`, {
  method: 'POST', body: JSON.stringify({ revision }),
  headers: groqApiKey ? { 'X-Groq-Api-Key': groqApiKey } : trial ? { 'X-Groq-Trial': 'true' } : undefined,
  // Analysis holds the request open for the provider call; keep it well
  // under the server's analysis lease while far above normal API latency.
  timeout: 150000,
})

export const confirmAnalysis = (noteId, revision, items) => apiRequest(`/notes/${noteId}/confirm-analysis/`, {
  method: 'POST', body: JSON.stringify({ revision, items })
})

export async function listItems(query = '', { page = 1, ...options } = {}) {
  const params = new URLSearchParams(query)
  if (page > 1) params.set('page', String(page))
  const suffix = params.toString()
  const { items, hasMore } = unwrapPage(await apiRequest(`/items/${suffix ? `?${suffix}` : ''}`, options))
  return { items, hasMore }
}

/** Completeness-needing callers (tabs, due-today): loops bounded pages. */
export async function listAllItems(query = '', options = {}) {
  const all = []
  let page = 1
  for (;;) {
    const { items, hasMore } = await listItems(query, { ...options, page })
    all.push(...items)
    if (!hasMore) break
    page += 1
  }
  return all
}

export const createItem = (payload) => apiRequest('/items/', {
  method: 'POST', body: JSON.stringify(payload),
})

export const patchItem = (id, revision, changes) => apiRequest(`/items/${id}/`, {
  method: 'PATCH', body: JSON.stringify({ ...changes, revision })
})
