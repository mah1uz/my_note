export function hourInTimezone(now = new Date(), timeZone) {
  if (!timeZone) return now.getHours()
  try {
    const hour = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(now)
    const parsed = parseInt(String(hour).replace(/[^0-9]/g, ''), 10)
    if (Number.isNaN(parsed)) return now.getHours()
    return parsed % 24
  } catch {
    return now.getHours()
  }
}

export function getGreeting(now = new Date(), timeZone) {
  const hour = hourInTimezone(now, timeZone)
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 21) return 'Good evening'
  return 'Good night'
}

export function formatNoteStamp(iso, timeZone) {
  if (!iso) return { date: '', time: '' }
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' }
  try {
    const date = new Intl.DateTimeFormat('en-US', {
      ...(timeZone ? { timeZone } : {}), month: 'short', day: 'numeric',
    }).format(parsed)
    const time = new Intl.DateTimeFormat('en-US', {
      ...(timeZone ? { timeZone } : {}), hour: 'numeric', minute: '2-digit',
    }).format(parsed)
    return { date, time }
  } catch {
    return {
      date: parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    }
  }
}
