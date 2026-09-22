import { apiRequest } from './http'

export const getReview = (noteId) => apiRequest(`/notes/${noteId}/review/`)

export const analyzeNote = (noteId, revision, groqApiKey = '') => apiRequest(`/notes/${noteId}/analyze/`, {
  method: 'POST', body: JSON.stringify({ revision }),
  headers: groqApiKey ? { 'X-Groq-Api-Key': groqApiKey } : undefined,
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
