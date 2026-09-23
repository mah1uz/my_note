import { describe, expect, it } from 'vitest'
import { itemForm, itemPayload } from './itemForm'

describe('item form metadata round-trip', () => {
  it('keeps server review signals for display but never submits them', () => {
    const form = itemForm({
      item_type: 'EXPENSE', title: 'Shampoo', amount: '100', currency: 'BDT',
      domains: ['shopping'], metadata: { tense_conflict: 'Looks like a future purchase.' },
    })
    expect(form.metadata.tense_conflict).toBe('Looks like a future purchase.')
    const payload = itemPayload(form)
    expect(payload).not.toHaveProperty('metadata')
    expect(payload).not.toHaveProperty('confidence')
    expect(payload.title).toBe('Shampoo')
  })

  it('defaults metadata to an empty object', () => {
    expect(itemForm({ title: 'Plain' }).metadata).toEqual({})
  })
})
