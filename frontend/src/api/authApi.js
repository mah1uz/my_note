import { apiRequest, refreshAccessToken, setAccessToken } from './http'

export async function registerAccount(payload) {
  const data = await apiRequest('/auth/register/', { method: 'POST', body: JSON.stringify(payload) }, false)
  setAccessToken(data.access)
  return data.user
}

export async function loginAccount(identity, password) {
  const data = await apiRequest('/auth/login/', { method: 'POST', body: JSON.stringify({ identity, password }) }, false)
  setAccessToken(data.access)
  return data.user
}

export async function restoreSession() {
  try {
    await refreshAccessToken()
    return await apiRequest('/auth/me/', {}, false)
  } catch (error) {
    setAccessToken(null)
    throw error
  }
}

export async function logoutAccount() {
  try {
    await apiRequest('/auth/logout/', { method: 'POST', body: '{}' }, false)
  } finally {
    setAccessToken(null)
  }
}

export const requestPasswordReset = (email) => apiRequest('/auth/password-reset/', { method: 'POST', body: JSON.stringify({ email }) }, false)

export const confirmPasswordReset = (payload) => apiRequest('/auth/password-reset/confirm/', { method: 'POST', body: JSON.stringify(payload) }, false)
