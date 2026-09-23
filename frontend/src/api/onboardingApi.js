import { apiRequest } from './http'

export function completeOnboarding(payload) {
  return apiRequest('/auth/onboarding/complete/', { method: 'POST', body: JSON.stringify(payload) })
}

export function getSettings(signal) {
  return apiRequest('/auth/settings/', { signal })
}
