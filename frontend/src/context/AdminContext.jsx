import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { adminLogin, adminLogout, adminMe, getAdminToken, setAdminToken } from '../api/adminApi'
import { clearSessionGroqKey } from './AiKeyContext'

const AdminContext = createContext(null)

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [canManageAdmins, setCanManageAdmins] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!getAdminToken()) {
      setLoading(false)
      return undefined
    }
    adminMe().then((data) => {
      if (!active) return
      setAdmin(data.admin)
      setCanManageAdmins(data.can_manage_admins)
    }).catch(() => {
      if (!active) return
      setAdminToken(null)
      setAdmin(null)
      setCanManageAdmins(false)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const login = async (username, password) => {
    const data = await adminLogin(username, password)
    setAdmin(data.admin)
    setCanManageAdmins(data.can_manage_admins)
    return data.admin
  }

  const logout = async () => {
    try {
      await adminLogout()
    } finally {
      clearSessionGroqKey()
      setAdmin(null)
      setCanManageAdmins(false)
    }
  }

  const value = useMemo(
    () => ({ admin, canManageAdmins, isAuthenticated: Boolean(admin), loading, login, logout }),
    [admin, canManageAdmins, loading],
  )
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) throw new Error('useAdmin must be used inside AdminProvider')
  return context
}
