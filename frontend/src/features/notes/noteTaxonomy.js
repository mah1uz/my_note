export const NOTE_TABS = [
  { key: 'categories', label: 'Categories' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'events', label: 'Events' },
  { key: 'study', label: 'Study' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'all', label: 'All notes' },
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

/** True when a confirmed item is a study note (education domain, any type). */
export function isStudyCategory(item) {
  return (item?.domains || []).includes('education')
}

/**
 * Group confirmed items by their source note id.
 * Returns { [noteId]: { tasks: bool, events: bool, shopping: bool, study: bool } }.
 * Study (education domain) is independent: an education EVENT sets both
 * events and study so the note appears under both tabs.
 * Pure helper, unit-tested through the notes tabs.
 */
export function groupItemsByNote(items) {
  const groups = Object.create(null)
  for (const item of items || []) {
    if (!item || item.is_confirmed === false) continue
    const key = String(item.note ?? item.note_id ?? '')
    if (!key) continue
    if (!groups[key]) groups[key] = { tasks: false, events: false, shopping: false, study: false }
    if (isShoppingCategory(item)) groups[key].shopping = true
    else if (isTaskCategory(item)) groups[key].tasks = true
    else if (isEventCategory(item)) groups[key].events = true
    if (isStudyCategory(item)) groups[key].study = true
  }
  return groups
}

/** True when a note has at least one confirmed category. */
export function hasAnyCategory(group) {
  return Boolean(group && (group.tasks || group.events || group.shopping || group.study))
}

/** Count distinct notes with at least one pending confirmed item in the tab. */
export function countPendingNotes(notes, items, category) {
  const match = {
    tasks: isTaskCategory,
    events: isEventCategory,
    study: isStudyCategory,
    shopping: isShoppingCategory,
  }[category]
  if (!match) return 0
  const visibleIds = new Set((notes || []).map((note) => String(note.id)))
  const pendingIds = new Set()
  for (const item of items || []) {
    const id = String(item?.note ?? item?.note_id ?? '')
    if (visibleIds.has(id) && item?.is_confirmed !== false && item?.status === 'PENDING' && match(item)) {
      pendingIds.add(id)
    }
  }
  return pendingIds.size
}

/**
 * Card heading: prefers the LLM-derived aiTitle persisted on the note,
 * then the first confirmed item title, then the raw-text first line.
 * Pure helper — no network, no per-card fetch.
 */
export function getNoteHeading(note, items = []) {
  const aiTitle = String(note?.aiTitle || '').trim()
  if (aiTitle) return aiTitle
  const first = (items || [])[0]
  const itemTitle = String(first?.title || '').trim().split('\n')[0].trim()
  if (itemTitle) return itemTitle.slice(0, 120)
  const raw = String(note?.originalText || '').trim().split('\n')[0].trim()
  if (!raw) return 'Untitled note'
  if (raw.length <= 80) return raw
  const cut = raw.slice(0, 80)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()
}

/**
 * Small LLM-derived tags for a card: unique domain slugs plus the item-type
 * label, from already-loaded confirmed items. No per-card fetch.
 * Returns at most 4 lowercase tags, e.g. ['shopping', 'task'].
 */
export function getNoteTags(items = []) {
  const tags = []
  const seen = new Set()
  for (const item of items || []) {
    if (!item) continue
    for (const domain of item.domains || []) {
      const tag = String(domain || '').trim().toLowerCase()
      if (tag && !seen.has(tag)) {
        seen.add(tag)
        tags.push(tag)
      }
    }
    const kind = String(item.item_type || '').trim().toLowerCase()
    if (kind && !seen.has(kind)) {
      seen.add(kind)
      tags.push(kind)
    }
    if (tags.length >= 4) break
  }
  return tags.slice(0, 4)
}

/**
 * Primary category label for the highlighted chip, derived from the note's
 * confirmed group. Falls back to the first tag.
 */
export function primaryCategory(group, tags = []) {
  if (group?.shopping) return 'shopping'
  if (group?.tasks) return 'tasks'
  if (group?.events) return 'events'
  if (group?.study) return 'study-notes'
  return tags[0] || ''
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
