import { describe, expect, it } from 'vitest'
import {
  countPendingNotes,
  getNoteHeading,
  getNoteTags,
  groupItemsByNote,
  hasAnyCategory,
  isStudyCategory,
  primaryCategory,
} from './noteTaxonomy'

describe('category-first taxonomy helpers', () => {
  it('counts notes with pending items, not total items or completed notes', () => {
    const notes = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    const items = [
      { note: 1, item_type: 'TASK', domains: ['work'], status: 'PENDING', is_confirmed: true },
      { note: 1, item_type: 'TASK', domains: ['work'], status: 'PENDING', is_confirmed: true },
      { note: 2, item_type: 'TASK', domains: ['work'], status: 'COMPLETED', is_confirmed: true },
      { note: 2, item_type: 'EVENT', domains: ['education'], status: 'PENDING', is_confirmed: true },
      { note: 3, item_type: 'TASK', domains: ['shopping'], status: 'PENDING', is_confirmed: true },
      { note: 4, item_type: 'INFORMATION', domains: ['education'], status: 'PENDING', is_confirmed: false },
      { note: 99, item_type: 'TASK', domains: ['work'], status: 'PENDING', is_confirmed: true },
    ]
    expect(countPendingNotes(notes, items, 'tasks')).toBe(1)
    expect(countPendingNotes(notes, items, 'events')).toBe(1)
    expect(countPendingNotes(notes, items, 'study')).toBe(1)
    expect(countPendingNotes(notes, items, 'shopping')).toBe(1)
    expect(countPendingNotes(notes, items, 'all')).toBe(0)
  })
  it('groups study notes separately from tasks, events, and shopping', () => {
    const items = [
      { id: 1, note: 1, item_type: 'TASK', domains: ['finance'], is_confirmed: true },
      { id: 2, note: 2, item_type: 'EVENT', domains: ['work'], is_confirmed: true },
      { id: 3, note: 3, item_type: 'TASK', domains: ['shopping'], is_confirmed: true },
      { id: 4, note: 4, item_type: 'INFORMATION', domains: ['education'], is_confirmed: true },
      { id: 5, note: 5, item_type: 'EVENT', domains: ['education'], is_confirmed: true },
      { id: 6, note: 6, item_type: 'TASK', domains: ['finance'], is_confirmed: false },
    ]
    const groups = groupItemsByNote(items)
    expect(groups['1']).toMatchObject({ tasks: true, study: false })
    expect(groups['2']).toMatchObject({ events: true, study: false })
    expect(groups['3']).toMatchObject({ shopping: true })
    expect(groups['4']).toMatchObject({ study: true })
    // Education is independent: an education EVENT appears in both tabs.
    expect(groups['5']).toMatchObject({ events: true, study: true })
    expect(groups['6']).toBeUndefined()
    expect(hasAnyCategory(groups['1'])).toBe(true)
    expect(hasAnyCategory(groups['4'])).toBe(true)
    expect(hasAnyCategory(undefined)).toBe(false)
    expect(isStudyCategory({ item_type: 'INFORMATION', domains: ['education'] })).toBe(true)
    expect(isStudyCategory({ item_type: 'TASK', domains: ['finance'] })).toBe(false)
  })

  it('prefers the LLM heading, then item titles, then raw text', () => {
    expect(getNoteHeading({ aiTitle: 'EM Quiz prep', originalText: 'raw' }, [])).toBe('EM Quiz prep')
    expect(getNoteHeading({ aiTitle: '', originalText: 'raw' }, [{ title: 'Buy eggs' }])).toBe('Buy eggs')
    expect(getNoteHeading({ aiTitle: '', originalText: 'First line\nSecond' }, [])).toBe('First line')
    expect(getNoteHeading({ aiTitle: '', originalText: '   ' }, [])).toBe('Untitled note')
  })

  it('derives small unique tags from already-loaded items only', () => {
    expect(getNoteTags([])).toEqual([])
    expect(getNoteTags([
      { item_type: 'TASK', domains: ['shopping', 'finance'] },
      { item_type: 'TASK', domains: ['shopping'] },
    ])).toEqual(['shopping', 'finance', 'task'])
    expect(primaryCategory({ shopping: true }, ['shopping'])).toBe('shopping')
    expect(primaryCategory({ study: true }, ['education'])).toBe('study-notes')
    expect(primaryCategory(null, ['work'])).toBe('work')
  })
})
