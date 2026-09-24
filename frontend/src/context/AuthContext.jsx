import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loginAccount, logoutAccount, registerAccount, restoreSession } from '../api/authApi'
import { supabase } from '../api/supabaseClient'
import { setAccessToken, setUnauthorizedHandler } from '../api/http'
import { clearSessionGroqKey } from './AiKeyContext'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Guards the boot restore against explicit auth actions: whichever started
  // last wins, so a slow restore can never clobber a fresh login/logout.
  // This removes the old login gate that serialized every submit behind the
  // boot fetch even when it had nothing to contribute.
  const generationRef = useRef(0)

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
    const generation = generationRef.current
    const restorePromise = restoreSession()
    restorePromise.then((user) => {
      if (active && generation === generationRef.current) setCurrentUser(user)
    }).catch(() => {
      if (active && generation === generationRef.current) setCurrentUser(null)
    }).finally(() => {
      if (active && generation === generationRef.current) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const login = async (identity, password) => {
    generationRef.current += 1
    try {
      const user = await loginAccount(identity, password)
      setCurrentUser(user)
      return user
    } finally {
      // The boot restore was invalidated above; it must not leave loading stuck.
      setLoading(false)
    }
  }

  const register = async (details) => {
    generationRef.current += 1
    try {
      const user = await registerAccount(details)
      setCurrentUser(user)
      return user
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    generationRef.current += 1
    try {
      await logoutAccount()
    } finally {
      clearSessionGroqKey()
      setCurrentUser(null)
      setLoading(false)
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
