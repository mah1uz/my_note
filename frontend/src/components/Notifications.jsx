import { useEffect, useRef, useState } from 'react'
import { BellIcon } from './icons'

/**
 * Notification bell + panel. Read state is server-owned: the parent passes
 * live rows plus mark-read callbacks wired to the notifications API.
 */
export default function Notifications({ items = [], onMarkRead, onMarkAllRead, actionError = '' }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const unread = items.filter((item) => !item.read)

  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open ])

  const markRead = (id) => {
    // The hook surfaces failures via actionError; never leave an
    // unhandled rejection on a fire-and-forget click.
    if (onMarkRead) Promise.resolve(onMarkRead(id)).catch(() => {})
  }
  const markAllRead = () => {
    if (onMarkAllRead) Promise.resolve(onMarkAllRead()).catch(() => {})
  }

  const age = (iso) => {
    if (!iso) return ''
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return days === 1 ? '1d ago' : `${days}d ago`
  }

  return (
    <div className="notifications" ref={panelRef}>
      <button
        type="button"
        className="icon-button bell-button"
        aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon size={19} />
        {unread.length > 0 && <span className="unread-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="notifications-panel" role="dialog" aria-label="Notifications">
          <div className="notifications-heading">
            <strong>Notifications</strong>
            {items.length > 0 && (
              <button type="button" className="text-button" onClick={markAllRead}>Mark all as read</button>
            )}
          </div>
          {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}
          {items.length === 0 ? (
            <div className="notifications-empty">
              <p>All caught up.</p>
              <small>Task reminders, completions, and account updates will appear here.</small>
            </div>
          ) : (
            <ul className="notifications-list">
              {items.map((item) => {
                const read = Boolean(item.read)
                return (
                  <li key={item.id} className={`notification-row${read ? ' is-read' : ''}`}>
                    <button type="button" onClick={() => markRead(item.id)} aria-label={`Mark ${item.title} as read`}>
                      <strong>{item.title}</strong>
                      {item.message ? <span>{item.message}</span> : null}
                      <small>{age(item.created_at)}</small>
                    </button>
                    {!read && <span className="unread-dot" aria-hidden="true" />}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
