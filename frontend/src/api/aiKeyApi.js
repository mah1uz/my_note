import { apiRequest } from './http'

export const getStoredKeyStatus = (signal) => apiRequest('/auth/ai/key/', { signal })

export const saveStoredKey = (key) => apiRequest('/auth/ai/key/', {
  method: 'POST', body: JSON.stringify({ key }),
})

export const deleteStoredKey = () => apiRequest('/auth/ai/key/', { method: 'DELETE' })
