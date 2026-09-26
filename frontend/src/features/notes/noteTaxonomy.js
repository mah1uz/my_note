export const NOTE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'events', label: 'Events' },
  { key: 'shopping', label: 'Shopping' },
]


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

export const DUE_TODAY_RE = /\b(today|tonight|this\s+morning|this\s+afternoon|this\s+evening|by\s+today|by\s+tonight|before\s+tonight|end\s+of\s+day|eod)\b/i

function dayStringInTimezone(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
    const get = (type) => parts.find((part) => part.type === type)?.value
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    return localDayString(date)
  }
}

export function todayString(now = new Date(), timeZone) {
  if (!timeZone) return localDayString(now)
  return dayStringInTimezone(now, timeZone)
}

/**
 * True when a PENDING task/event is due at some point today.
 * - TASK (including shopping): due_date / due_datetime == today.
 * - EVENT: start_date / start_datetime == today.
 * - Fallback: undated PENDING TASK from a note created today.
 * Completed/cancelled/archived items are never "today's tasks".
 */
export function isDueToday(item, now = new Date(), options = {}) {
  if (!item || item.status !== 'PENDING') return false
  const timeZone = options.timeZone
  const today = todayString(now, timeZone)
  const toDay = (value) => {
    if (!value) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value)
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return timeZone ? dayStringInTimezone(parsed, timeZone) : localDayString(parsed)
  }
  if (item.item_type === 'TASK') {
    if (item.due_date && item.due_date === today) return true
    if (item.due_datetime && toDay(item.due_datetime) === today) return true
    if (!item.due_date && !item.due_datetime && options.noteCreatedAt) {
      const createdDay = toDay(options.noteCreatedAt)
      if (createdDay === today) return true
    }
    return false
  }
  if (item.item_type === 'EVENT') {
    if (item.start_date && item.start_date === today) return true
    if (item.start_datetime && toDay(item.start_datetime) === today) return true
    if (item.due_date && item.due_date === today) return true
    if (item.due_datetime && toDay(item.due_datetime) === today) return true
    return false
  }
  return false
}

export function hasDueTodayHint(text) {
  return DUE_TODAY_RE.test(String(text || ''))
}
