import { supabase } from './supabaseClient'

const defaultHost = typeof window === 'undefined' ? 'localhost' : window.location.hostname
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${defaultHost}:8000/api/v1`

let accessToken = null
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

export async function apiRequest(path, options = {}, retry = true) {
  const headers = { ...options.headers }
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (response.status === 401 && retry) {
    try {
      if (!supabase) throw new Error('Supabase Auth is not configured.')
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) throw error || new Error('Supabase session refresh failed.')
      setAccessToken(data.session.access_token)
      return apiRequest(path, options, false)
    } catch {
      setAccessToken(null)
      unauthorizedHandler()
    }
  }
  return parseResponse(response)
}
