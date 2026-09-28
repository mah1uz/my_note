import { apiRequest, setAccessToken } from './http'
import { supabase } from './supabaseClient'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase Auth is not configured.')
}

async function supabaseProfile(session) {
  setAccessToken(session?.access_token || null)
  return apiRequest('/auth/me/', {}, false)
}

async function startRememberedSession(session) {
  setAccessToken(session?.access_token || null)
  return apiRequest('/auth/session/start/', { method: 'POST', body: '{}' }, false)
}

export async function registerAccount(payload) {
  requireSupabase()
  const { data, error } = await supabase.auth.signUp({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    options: { data: { full_name: payload.name.trim() } },
  })
  if (error) throw error
  if (!data.session) return null
  return startRememberedSession(data.session)
}

export async function loginAccount(identity, password) {
  requireSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: identity.trim().toLowerCase(), password,
  })
  if (error) throw error
  return startRememberedSession(data.session)
}

export async function restoreSession() {
  requireSupabase()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session) {
    setAccessToken(null)
    throw new Error('No active session.')
  }
  return supabaseProfile(data.session)
}

export async function completeOAuthSession() {
  requireSupabase()
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw error || new Error('No active session.')
  return startRememberedSession(data.session)
}

export async function logoutAccount() {
  requireSupabase()
  try { await apiRequest('/auth/session/end/', { method: 'POST', body: '{}' }, false) } catch { /* Supabase logout still runs. */ }
  const { error } = await supabase.auth.signOut()
  setAccessToken(null)
  if (error) throw error
}

export async function requestPasswordReset(email) {
  requireSupabase()
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
  return { detail: 'If the account exists, a reset link has been sent.' }
}

export async function confirmPasswordReset(payload) {
  requireSupabase()
  const { error } = await supabase.auth.updateUser({ password: payload.password })
  if (error) throw error
  return { detail: 'Password reset successfully.' }
}

export async function signInWithGoogle() {
  requireSupabase()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
  if (error) throw error
}
