import { apiRequest } from './http'

export function notifyItemsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rememberly:items-changed'))
}

export const getReview = (noteId) => apiRequest(`/notes/${noteId}/review/`)

export const analyzeNote = (noteId, revision, groqApiKey = '', trial = false) => apiRequest(`/notes/${noteId}/analyze/`, {
  method: 'POST', body: JSON.stringify({ revision }),
  headers: groqApiKey ? { 'X-Groq-Api-Key': groqApiKey } : trial ? { 'X-Groq-Trial': 'true' } : undefined,
  // Analysis holds the request open for the provider call; keep it well
  // under the server's analysis lease while far above normal API latency.
  timeout: 150000,
})

export const confirmAnalysis = async (noteId, revision, items) => {
  const result = await apiRequest(`/notes/${noteId}/confirm-analysis/`, {
  method: 'POST', body: JSON.stringify({ revision, items })
  })
  notifyItemsChanged()
  return result
}

export const listItems = (query = '', options = {}) => apiRequest(`/items/${query ? `?${query}` : ''}`, options)

export const createItem = async (payload) => {
  const result = await apiRequest('/items/', {
  method: 'POST', body: JSON.stringify(payload),
  })
  notifyItemsChanged()
  return result
}

export const patchItem = async (id, revision, changes) => {
  const result = await apiRequest(`/items/${id}/`, {
  method: 'PATCH', body: JSON.stringify({ ...changes, revision })
  })
  notifyItemsChanged()
  return result
}
