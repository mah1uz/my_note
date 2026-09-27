import { apiRequest } from './http'

export const AI_PROVIDERS = ['groq', 'gemini']
export const DEFAULT_AI_PROVIDER = 'groq'

export const getStoredKeyStatus = (provider = DEFAULT_AI_PROVIDER, signal) =>
  apiRequest(`/auth/ai/key/?provider=${provider}`, { signal })

export const saveStoredKey = (key, provider = DEFAULT_AI_PROVIDER) => apiRequest('/auth/ai/key/', {
  method: 'POST', body: JSON.stringify({ key, provider }),
})

export const deleteStoredKey = (provider = DEFAULT_AI_PROVIDER) =>
  apiRequest(`/auth/ai/key/?provider=${provider}`, { method: 'DELETE' })
