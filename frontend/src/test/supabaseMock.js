import { __setSupabaseForTests } from '../api/supabaseClient'
import { setAccessToken } from '../api/http'

export function installSupabaseMock(state) {
  const sessionFor = () => (state.authenticated
    ? { access_token: 'supabase-test-access', refresh_token: 'supabase-test-refresh', user: { id: state.profile.id, email: state.profile.email } }
    : null)

  const fake = {
    auth: {
      signUp: async ({ email }) => {
        if (state.authenticated === 'fail-signup') throw new Error('Sign up failed.')
        state.authenticated = true
        state.profile = { ...state.profile, email: email.toLowerCase() }
        return { data: { session: sessionFor() }, error: null }
      },
      signInWithPassword: async ({ email, password }) => {
        if (password === 'wrong-password' || state.failLogin) {
          return { data: {}, error: new Error('Invalid credentials.') }
        }
        if (email.toLowerCase() === 'bob@example.com') {
          state.profile = { id: '22222222-2222-4222-8222-222222222222', username: 'bob', email: 'bob@example.com', name: 'Bob User' }
          state.notes = [{ id: 9, raw_text: 'Bob private note', created_at: '2026-09-21T10:00:00Z' }]
        }
        state.authenticated = true
        return { data: { session: sessionFor() }, error: null }
      },
      getSession: async () => ({ data: { session: sessionFor() }, error: null }),
      signOut: async () => {
        state.authenticated = false
        setAccessToken(null)
        return { error: null }
      },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: {}, error: null }),
      refreshSession: async () => {
        const session = sessionFor()
        if (!session) return { data: { session: null }, error: new Error('No active session.') }
        return { data: { session }, error: null }
      },
      signInWithOAuth: async () => ({ data: {}, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }
  __setSupabaseForTests(fake)
  return fake
}
