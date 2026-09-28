import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeNote } from './itemsApi'
import { listNotes } from './notesApi'
import { ANALYZE_SPACING_MS, analyzeBacklog } from './processApi'

vi.mock('./itemsApi', () => ({ analyzeNote: vi.fn(), notifyItemsChanged: vi.fn() }))
vi.mock('./notesApi', () => ({ listNotes: vi.fn() }))

const note = (id, status, createdAt = `2026-09-${String(id).padStart(2, '0')}`) => ({
  id: String(id), revision: id, processingStatus: status, createdAt, isArchived: false,
})

describe('paced backlog analysis', () => {
  beforeEach(() => {
    vi.mocked(analyzeNote).mockReset()
    vi.mocked(listNotes).mockReset()
    vi.mocked(listNotes).mockResolvedValue([
      note(2, 'FAILED'), note(3, 'PROCESSED'), note(1, 'UNPROCESSED'), note(4, 'FAILED'),
    ])
    vi.mocked(analyzeNote).mockResolvedValue({})
  })

  it('waits for each response and spaces requests oldest-first without confirming', async () => {
    expect(ANALYZE_SPACING_MS).toBeGreaterThanOrEqual(10000)
    let releaseFirst
    let releaseWait
    vi.mocked(analyzeNote).mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve }))
    const wait = vi.fn(() => new Promise((resolve) => { releaseWait = resolve }))
    const run = analyzeBacklog({ apiKey: 'personal-key' }, { wait })
    await vi.waitFor(() => expect(analyzeNote).toHaveBeenCalledTimes(1))
    expect(analyzeNote).toHaveBeenCalledWith('1', 1, 'personal-key', false, 'groq', undefined)
    expect(wait).not.toHaveBeenCalled()
    releaseFirst({})
    await vi.waitFor(() => expect(wait).toHaveBeenCalledTimes(1))
    expect(wait).toHaveBeenCalledWith(ANALYZE_SPACING_MS, undefined)
    expect(analyzeNote).toHaveBeenCalledTimes(1)
    releaseWait()
    await vi.waitFor(() => expect(analyzeNote).toHaveBeenCalledTimes(2))
    expect(analyzeNote).toHaveBeenNthCalledWith(2, '2', 2, 'personal-key', false, 'groq', undefined)
    // For the third note, no additional provider call until the next pause ends.
    await vi.waitFor(() => expect(wait).toHaveBeenCalledTimes(2))
    releaseWait()
    expect((await run).results.map((row) => row.id)).toEqual(['1', '2', '4'])
    expect(analyzeNote).toHaveBeenCalledTimes(3)
  })

  it('stops on a provider rate limit instead of spending trials on later notes', async () => {
    vi.mocked(analyzeNote).mockRejectedValueOnce({ status: 503, data: { code: 'rate_limit' } })
    const wait = vi.fn()
    const result = await analyzeBacklog({ trial: true }, { wait })
    expect(result.stopped).toBe('rate_limit')
    expect(result.results.map(({ id, status }) => [id, status])).toEqual([
      ['1', 'failed'], ['2', 'skipped'], ['4', 'skipped'],
    ])
    expect(analyzeNote).toHaveBeenCalledTimes(1)
    expect(wait).not.toHaveBeenCalled()
  })

  it('does not send more requests after cancellation during a pause', async () => {
    const controller = new AbortController()
    const wait = vi.fn((_ms, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })
    }))
    const run = analyzeBacklog({}, { signal: controller.signal, wait })
    await vi.waitFor(() => expect(wait).toHaveBeenCalledTimes(1))
    controller.abort()
    expect((await run).stopped).toBe('cancelled')
    expect(analyzeNote).toHaveBeenCalledTimes(1)
  })
})
