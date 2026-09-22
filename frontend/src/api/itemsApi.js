import { apiRequest } from './http'

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

export const listItems = (query = '', options = {}) => apiRequest(`/items/${query ? `?${query}` : ''}`, options)

export const createItem = (payload) => apiRequest('/items/', {
  method: 'POST', body: JSON.stringify(payload),
})

export const patchItem = (id, revision, changes) => apiRequest(`/items/${id}/`, {
  method: 'PATCH', body: JSON.stringify({ ...changes, revision })
})
