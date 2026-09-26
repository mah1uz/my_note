import { describe, expect, it } from 'vitest'
import { countWords, previewNote } from './noteText'

describe('note word limits and card previews', () => {
  it('counts words separated by whitespace', () => {
    expect(countWords('  first\nsecond\t third  ')).toBe(3)
    expect(countWords('   ')).toBe(0)
  })

  it('shows 100 words in full and adds an ellipsis only if another word exists', () => {
    const hundred = Array.from({ length: 100 }, (_, index) => `word${index + 1}`).join(' ')
    expect(previewNote(hundred)).toBe(hundred)
    expect(previewNote(`${hundred} word101`)).toBe(`${hundred}...`)
    expect(previewNote('First line\nSecond line')).toBe('First line\nSecond line')
  })
})
