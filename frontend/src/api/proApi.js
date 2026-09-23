import { apiRequest } from './http'

export function getProRequest(signal) {
  return apiRequest('/auth/pro/request/', { signal })
}

export function createProRequest(reason = '') {
  return apiRequest('/auth/pro/request/', { method: 'POST', body: JSON.stringify({ reason }) })
}
