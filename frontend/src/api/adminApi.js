import { ApiError } from './http'

const defaultHost = typeof window === 'undefined' ? 'localhost' : window.location.hostname
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${defaultHost}:8000/api/v1`

const TOKEN_KEY = 'rememberly_admin_token'

function storedToken() {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

let adminToken = storedToken()

export function getAdminToken() {
  return adminToken
}

export function setAdminToken(token) {
  adminToken = token || null
  try {
    if (adminToken) window.sessionStorage.setItem(TOKEN_KEY, adminToken)
    else window.sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* private-mode browsers: memory-only token */ }
}

function errorMessage(data, fallback) {
  if (typeof data?.detail === 'string') return data.detail
  if (data && typeof data === 'object') {
    const first = Object.values(data).flat()[0]
    if (typeof first === 'string') return first
  }
  return fallback
}

async function parseResponse(response) {
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(errorMessage(data, 'The request could not be completed.'), response.status, data)
  return data
}

export async function adminRequest(path, options = {}) {
  const headers = { ...options.headers }
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (adminToken) headers.Authorization = `Token ${adminToken}`
  // Same hang class as the main client: a stalled admin request must time
  // out instead of spinning forever.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, signal: controller.signal })
    return parseResponse(response)
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('The admin request timed out. Try again.', 408, null)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function adminLogin(username, password) {
  const data = await adminRequest('/admin/login/', {
    method: 'POST', body: JSON.stringify({ username, password }),
  })
  setAdminToken(data.token)
  return data
}

export async function adminLogout() {
  try {
    await adminRequest('/admin/logout/', { method: 'POST', body: '{}' })
  } finally {
    setAdminToken(null)
  }
}

export const adminMe = () => adminRequest('/admin/me/')

export function listUsers({ search = '', status = '', page = 1 } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return adminRequest(`/admin/users/${query ? `?${query}` : ''}`)
}

export const getUser = (id) => adminRequest(`/admin/users/${id}/`)

export const patchUser = (id, changes) => adminRequest(`/admin/users/${id}/`, {
  method: 'PATCH', body: JSON.stringify(changes),
})

export const deleteUser = (id) => adminRequest(`/admin/users/${id}/?confirm=true`, { method: 'DELETE' })

export const listAdmins = () => adminRequest('/admin/admins/')

export const createAdmin = (payload) => adminRequest('/admin/admins/', {
  method: 'POST', body: JSON.stringify(payload),
})

export const patchAdmin = (id, changes) => adminRequest(`/admin/admins/${id}/`, {
  method: 'PATCH', body: JSON.stringify(changes),
})

export const getAiSettings = () => adminRequest('/admin/ai-settings/')

export const patchAiSettings = (enabled) => adminRequest('/admin/ai-settings/', {
  method: 'PATCH', body: JSON.stringify({ server_ai_enabled: enabled }),
})
