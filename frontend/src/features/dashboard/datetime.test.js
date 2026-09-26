import { describe, expect, it } from 'vitest'
import { formatNoteStamp, getGreeting } from './datetime'
import { hasDueTodayHint, isDueToday } from '../notes/noteTaxonomy'

describe('time-based greeting', () => {
  it('greets by hour of day', () => {
    expect(getGreeting(new Date(2026, 8, 26, 7, 30))).toBe('Good morning')
    expect(getGreeting(new Date(2026, 8, 26, 13, 0))).toBe('Good afternoon')
    expect(getGreeting(new Date(2026, 8, 26, 19, 50))).toBe('Good evening')
    expect(getGreeting(new Date(2026, 8, 26, 23, 0))).toBe('Good night')
  })
})

describe('note timestamps', () => {
  it('formats date plus exact time', () => {
    const { date, time } = formatNoteStamp('2026-09-26T19:50:00.000Z', 'Asia/Dhaka')
    expect(date).toBeTruthy()
    expect(time).toMatch(/\d{1,2}:\d{2}/)
  })

  it('returns empty parts for bad input', () => {
    expect(formatNoteStamp('not-a-date')).toEqual({ date: '', time: '' })
  })
})

describe("today's tasks rule", () => {
  const now = new Date(2026, 8, 26, 12, 0, 0)
  const today = '2026-09-26'

  it('matches explicit task due dates and event start dates', () => {
    expect(isDueToday({ item_type: 'TASK', status: 'PENDING', due_date: today }, now)).toBe(true)
    expect(isDueToday({ item_type: 'EVENT', status: 'PENDING', start_date: today }, now)).toBe(true)
    expect(isDueToday({ item_type: 'TASK', status: 'COMPLETED', due_date: today }, now)).toBe(false)
  })

  it('includes undated tasks from notes created today, excludes old notes', () => {
    expect(isDueToday(
      { item_type: 'TASK', status: 'PENDING' }, now,
      { noteCreatedAt: new Date(2026, 8, 26, 9, 0, 0).toISOString() },
    )).toBe(true)
    expect(isDueToday(
      { item_type: 'TASK', status: 'PENDING' }, now,
      { noteCreatedAt: '2026-09-01T08:00:00Z' },
    )).toBe(false)
  })

  it('detects explicit today language', () => {
    expect(hasDueTodayHint('I have work today')).toBe(true)
    expect(hasDueTodayHint('buy shampoo')).toBe(false)
  })
})
