import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { loginAccount, logoutAccount, registerAccount, restoreSession } from '../api/authApi'
import { setUnauthorizedHandler } from '../api/http'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUnauthorizedHandler(() => setCurrentUser(null))
    return () => setUnauthorizedHandler(() => {})
  }, [])

  useEffect(() => {
    let active = true
    restoreSession().then((user) => {
      if (active) setCurrentUser(user)
    }).catch(() => {
      if (active) setCurrentUser(null)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const login = async (identity, password) => {
    const user = await loginAccount(identity, password)
    setCurrentUser(user)
    return user
  }

  const register = async (details) => {
    const user = await registerAccount(details)
    setCurrentUser(user)
    return user
  }

  const logout = async () => {
    try {
      await logoutAccount()
    } finally {
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
