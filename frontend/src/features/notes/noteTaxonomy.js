import { useEffect, useState } from 'react'
import { listItems } from '../../api/itemsApi'
import { useAuth } from '../../context/AuthContext'

export const NOTE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'events', label: 'Events' },
  { key: 'shopping', label: 'Shopping' },
]

/** Abuse barrier: notes are capped at 100 characters in every input. */
export const NOTE_MAX_LENGTH = 100

function localDayString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** True when a confirmed item is a non-shopping TASK. */
export function isTaskCategory(item) {
  return item?.item_type === 'TASK' && !(item.domains || []).includes('shopping')
}

/** True when a confirmed item is an EVENT. */
export function isEventCategory(item) {
  return item?.item_type === 'EVENT'
}

/** True when a confirmed item is a shopping TASK. */
export function isShoppingCategory(item) {
  return item?.item_type === 'TASK' && (item.domains || []).includes('shopping')
}

/**
 * Group confirmed items by their source note id.
 * Returns { [noteId]: { tasks: bool, events: bool, shopping: bool } }.
 * Pure helper, unit-tested through the notes tabs.
 */
export function groupItemsByNote(items) {
  const groups = Object.create(null)
  for (const item of items || []) {
    if (!item || item.is_confirmed === false) continue
    const key = String(item.note ?? item.note_id ?? '')
    if (!key) continue
    if (!groups[key]) groups[key] = { tasks: false, events: false, shopping: false }
    if (isShoppingCategory(item)) groups[key].shopping = true
    else if (isTaskCategory(item)) groups[key].tasks = true
    else if (isEventCategory(item)) groups[key].events = true
  }
  return groups
}

/**
 * True when a PENDING task is due at some point today (local calendar day).
 * Accepts date-only facts (due_date) and timed facts (due_datetime).
 * Completed/cancelled tasks are never "today's tasks".
 */
export function isDueToday(item, now = new Date()) {
  if (!item || item.item_type !== 'TASK' || item.status !== 'PENDING') return false
  const today = localDayString(now)
  if (item.due_date) return item.due_date === today
  if (item.due_datetime) {
    const parsed = new Date(item.due_datetime)
    if (Number.isNaN(parsed.getTime())) return false
    return localDayString(parsed) === today
  }
  return false
}

/**
 * Fetch all confirmed items once and expose the per-note category map
 * plus the raw items. Scoped to the current account like every list.
 */
export function useConfirmedItems() {
  const { currentUser } = useAuth()
  const [state, setState] = useState({ loading: true, items: [], error: '' })
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const owner = currentUser?.id
    setState({ loading: true, items: [], error: '' })
    listItems('', { signal: controller.signal }).then(
      (items) => { if (!controller.signal.aborted) setState({ loading: false, items: Array.isArray(items) ? items : [], error: '' }) },
      () => { if (!controller.signal.aborted) setState({ loading: false, items: [], error: 'Categories are unavailable right now.' }) },
    )
    return () => controller.abort()
  }, [currentUser?.id, epoch])
  return { ...state, refresh: () => setEpoch((value) => value + 1) }
}
