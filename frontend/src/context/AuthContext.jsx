import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loginAccount, logoutAccount, registerAccount, restoreSession } from '../api/authApi'
import { supabase } from '../api/supabaseClient'
import { setAccessToken, setUnauthorizedHandler } from '../api/http'
import { clearSessionGroqKey } from './AiKeyContext'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const restorePromiseRef = useRef(Promise.resolve())

  useEffect(() => {
    setUnauthorizedHandler(() => { clearSessionGroqKey(); setCurrentUser(null) })
    return () => setUnauthorizedHandler(() => {})
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token || null)
      if (!session) setCurrentUser(null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let active = true
    const restorePromise = restoreSession()
    restorePromiseRef.current = restorePromise
    restorePromise.then((user) => {
      if (active) {
        setCurrentUser(user)
        window.dispatchEvent(new Event('rememberly:auth-changed'))
      }
    }).catch(() => {
      if (active) setCurrentUser(null)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const login = async (identity, password) => {
    await restorePromiseRef.current.catch(() => {})
    const user = await loginAccount(identity, password)
    setCurrentUser(user)
    window.dispatchEvent(new Event('rememberly:auth-changed'))
    return user
  }

  const register = async (details) => {
    await restorePromiseRef.current.catch(() => {})
    const user = await registerAccount(details)
    setCurrentUser(user)
    window.dispatchEvent(new Event('rememberly:auth-changed'))
    return user
  }

  const logout = async () => {
    await restorePromiseRef.current.catch(() => {})
    try {
      await logoutAccount()
    } finally {
      clearSessionGroqKey()
      setCurrentUser(null)
    }
  }

  const value = useMemo(() => ({ currentUser, isAuthenticated: Boolean(currentUser), loading, login, register, logout }), [currentUser, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
