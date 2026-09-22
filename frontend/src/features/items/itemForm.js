export const domains = ['education', 'shopping', 'finance', 'work', 'personal', 'health', 'entertainment', 'travel', 'other']
export const itemTypes = ['TASK', 'EVENT', 'EXPENSE', 'INFORMATION']
export const itemStatuses = ['PENDING', 'COMPLETED', 'CANCELLED', 'ARCHIVED']
export const importances = ['LOW', 'NORMAL', 'HIGH']

function dhakaParts(value) {
  if (!value) return { date: '', time: '' }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

export function itemForm(item = {}) {
  const start = dhakaParts(item.start_datetime)
  const due = dhakaParts(item.due_datetime)
  return {
    id: item.id, confidence: item.confidence ?? null,
    item_type: item.item_type || 'TASK', title: item.title || '',
    summary: item.summary || '', normalized_text: item.normalized_text || '',
    domains: item.domains || [], importance: item.importance || 'NORMAL', status: item.status || 'PENDING',
    startDate: item.start_date || start.date, startTime: start.time,
    dueDate: item.due_date || due.date, dueTime: due.time,
    amount: item.amount ?? '', currency: item.currency || '', quantity: item.quantity ?? '',
    unit: item.unit || '', place_hint: item.place_hint || ''
  }
}

export function itemPayload(form) {
  const data = {
    item_type: form.item_type, title: form.title.trim(), summary: form.summary,
    normalized_text: form.normalized_text, domains: form.domains,
    importance: form.importance, status: form.status,
    amount: form.amount === '' ? null : form.amount,
    currency: form.currency.trim() || null, quantity: form.quantity === '' ? null : form.quantity,
    unit: form.unit.trim() || null, place_hint: form.place_hint.trim() || null
  }
  for (const prefix of ['start', 'due']) {
    const date = form[`${prefix}Date`]
    const time = form[`${prefix}Time`]
    data[`${prefix}_date`] = date && !time ? date : null
    data[`${prefix}_datetime`] = date && time ? `${date}T${time}:00+06:00` : null
  }
  if (form.id) data.id = form.id
  return data
}

export function itemDate(item, prefix = 'start') {
  if (item[`${prefix}_date`]) return `${item[`${prefix}_date`]} · time not specified`
  if (item[`${prefix}_datetime`]) {
    const { date, time } = dhakaParts(item[`${prefix}_datetime`])
    return `${date} ${time} · Asia/Dhaka`
  }
  return 'Date not specified'
}

export function requestErrorText(error) {
  if (error.data?.detail) return error.data.detail
  if (!error.data) return error.message || 'The request failed. Please try again.'
  const lines = []
  function visit(value, path = '') {
    if (typeof value === 'string') lines.push(`${path ? `${path}: ` : ''}${value}`)
    else if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, typeof entry === 'string' ? path : `${path} ${index + 1}`))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, entry]) => visit(entry, `${path} ${key}`.trim()))
  }
  visit(error.data)
  return lines.join(' · ') || error.message
}
