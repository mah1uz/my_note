const defaultHost = typeof window === 'undefined' ? 'localhost' : window.location.hostname
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${defaultHost}:8000/api/v1`

let accessToken = null
let refreshPromise = null
let authTransitionPromise = null
let unauthorizedHandler = () => {}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export function setAccessToken(token) {
  accessToken = token
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export async function withAuthTransition(operation) {
  while (authTransitionPromise) await authTransitionPromise
  let releaseTransition
  authTransitionPromise = new Promise((resolve) => { releaseTransition = resolve })
  try {
    if (refreshPromise) await refreshPromise.catch(() => {})
    return await operation()
  } finally {
    authTransitionPromise = null
    releaseTransition()
  }
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

export function refreshAccessToken() {
  if (authTransitionPromise) return authTransitionPromise.then(() => refreshAccessToken())
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }).then(parseResponse).then((data) => {
      setAccessToken(data.access)
      return data
    }).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function apiRequest(path, options = {}, retry = true) {
  const headers = { ...options.headers }
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
  if (response.status === 401 && retry && path !== '/auth/refresh/') {
    try {
      await refreshAccessToken()
      return apiRequest(path, options, false)
    } catch {
      setAccessToken(null)
      unauthorizedHandler()
    }
  }
  return parseResponse(response)
}
