import { apiRequest } from './http'

export function searchNotes(query, signal) {
  return apiRequest('/search/', { method: 'POST', body: JSON.stringify({ query }), signal })
}

export function askNotes(query, signal) {
  return apiRequest('/search/answer/', { method: 'POST', body: JSON.stringify({ query }), signal })
}
