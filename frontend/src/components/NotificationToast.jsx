import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api/http'
import { BellIcon } from './icons'

const DISMISS_MS = 6000

/**
 * Arrival popup for notifications. Only rows created after this component
 * mounts ever pop up, and only when the account's master notification
 * switch (notification_enabled) is on. Otherwise the bell stays silent:
 * muted means muted, unread rows simply wait in the panel.
 */
export default function NotificationToast({ items = [] }) {
  const [enabled, setEnabled] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [visible, setVisible] = useState([])
  const seen = useRef(null)
  const timers = useRef([])

  useEffect(() => {
    let active = true
    apiRequest('/auth/preferences/', {}, false)
      .then((prefs) => { if (active) setEnabled(Boolean(prefs.notification_enabled)) })
      .catch(() => { if (active) setEnabled(false) })
      .finally(() => { if (active) setPrefsLoaded(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    // Until the master switch is known, hold everything: nothing is marked
    // seen, so nothing can be silently swallowed.
    if (!prefsLoaded) return
    if (seen.current === null) {
      // First snapshot: everything already here is history, never popup.
      seen.current = new Set(items.map((item) => String(item.id)))
      return
    }
    if (!enabled) {
      for (const item of items) seen.current.add(String(item.id))
      return
    }
    const fresh = items.filter((item) => !item.read && !seen.current.has(String(item.id)))
    for (const item of items) seen.current.add(String(item.id))
    if (!fresh.length) return
    setVisible((current) => {
      const ids = new Set(current.map((item) => String(item.id)))
      return [...current, ...fresh.filter((item) => !ids.has(String(item.id)))].slice(-3)
    })
    for (const item of fresh) {
      const timer = window.setTimeout(() => {
        setVisible((current) => current.filter((row) => String(row.id) !== String(item.id)))
      }, DISMISS_MS)
      timers.current.push(timer)
    }
  }, [items, enabled, prefsLoaded])

  useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer)
  }, [])

  const dismiss = (id) => {
    setVisible((current) => current.filter((row) => String(row.id) !== String(id)))
  }

  if (!visible.length) return null
  return (
    <div className="toast-stack" aria-live="polite">
      {visible.map((item) => (
        <div key={item.id} className="toast" role="status">
          <span className="toast-icon" aria-hidden="true"><BellIcon size={16} /></span>
          <div className="toast-main">
            <strong>{item.title}</strong>
            {item.message ? <small>{item.message}</small> : null}
          </div>
          <button type="button" className="text-button" aria-label={`Dismiss ${item.title}`} onClick={() => dismiss(item.id)}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  )
}
