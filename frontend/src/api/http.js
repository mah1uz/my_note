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

export class TimeoutError extends Error {
  constructor(message = 'The request timed out. Check your connection and try again.') {
    super(message)
    this.name = 'TimeoutError'
  }
}

const DEFAULT_TIMEOUT_MS = 30000

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

/**
 * Normalize list responses across shapes: legacy/test arrays pass through,
 * DRF paginated pages unwrap to {items, count, hasMore}. Every list caller
 * goes through here so backend pagination never breaks the UI.
 */
export function unwrapPage(data) {
  if (Array.isArray(data)) return { items: data, count: data.length, hasMore: false }
  if (data && Array.isArray(data.results)) {
    return { items: data.results, count: data.count ?? data.results.length, hasMore: Boolean(data.next) }
  }
  return { items: [], count: 0, hasMore: false }
}

export async function apiRequest(path, options = {}, retry = true) {
  const { timeout = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...fetchOptions } = options
  const headers = { ...fetchOptions.headers }
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  // A hung connection must never leave the UI stuck on a spinner: every
  // request races a timeout, and navigation/unmount can still abort early.
  const controller = new AbortController()
  const onCallerAbort = () => controller.abort(callerSignal?.reason)
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason)
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true })
  }
  const timer = setTimeout(() => controller.abort(new TimeoutError()), timeout)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...fetchOptions, headers, signal: controller.signal })
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
    return await parseResponse(response)
  } catch (error) {
    // Timeout and caller aborts both surface as a TimeoutError; API
    // failures keep their ApiError. Callers ignore errors after unmount.
    if (error instanceof ApiError) throw error
    if (controller.signal.aborted) throw new TimeoutError()
    throw error
  } finally {
    clearTimeout(timer)
    callerSignal?.removeEventListener?.('abort', onCallerAbort)
  }
}
