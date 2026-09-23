import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/notificationsApi'

/**
 * Server-owned notification state. Listing evaluates due/expense
 * eligibility on the backend, so a plain reload is the refresh path.
 */
export function useNotifications() {
  const { currentUser } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')

  const reload = useCallback(async () => {
    if (!currentUser) {
      setItems([])
      setLoading(false)
      return []
    }
    setLoading(true)
    try {
      const rows = await listNotifications()
      if (Array.isArray(rows)) setItems(rows)
      return rows
    } catch {
      return items
    } finally {
      setLoading(false)
    }
  }, [currentUser]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true
    listNotifications()
      .then((rows) => { if (active) { if (Array.isArray(rows)) setItems(rows); setLoading(false) } })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [currentUser?.id])

  const markRead = useCallback(async (id) => {
    setActionError('')
    try {
      const updated = await markNotificationRead(id)
      setItems((current) => current.map((item) => (String(item.id) === String(id) ? updated : item)))
      return updated
    } catch (requestError) {
      setActionError(requestError.message)
      throw requestError
    }
  }, [])

  const markAllRead = useCallback(async () => {
    setActionError('')
    try {
      await markAllNotificationsRead()
      setItems((current) => current.map((item) => ({ ...item, read: true, read_at: item.read_at || new Date().toISOString() })))
    } catch (requestError) {
      setActionError(requestError.message)
      throw requestError
    }
  }, [])

  return { items, loading, actionError, unreadCount: items.filter((item) => !item.read).length, reload, markRead, markAllRead }
}
