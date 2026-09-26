import { describe, expect, it, vi, afterEach } from 'vitest'
import { autoOrganize, isAiConfigured } from './autoOrganize'

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  }))
}

const draft = {
  id: 11, item_type: 'TASK', title: 'File taxes', summary: '', normalized_text: 'File taxes',
  domains: ['finance'], status: 'PENDING', importance: 'NORMAL',
  start_date: null, due_date: '2026-09-26', start_datetime: null, due_datetime: null,
  amount: null, currency: null, quantity: null, unit: null, place_hint: null,
  confidence: 0.9, is_confirmed: false, note: 1, revision: 1,
}

describe('isAiConfigured', () => {
  it('accepts session keys, saved keys, and trial', () => {
    expect(isAiConfigured({})).toBe(false)
    expect(isAiConfigured({ groqApiKey: 'gsk_x' })).toBe(true)
    expect(isAiConfigured({ storedKey: { has_key: true } })).toBe(true)
    expect(isAiConfigured({ storedKey: { has_key: false } })).toBe(false)
    expect(isAiConfigured({ trialActive: true })).toBe(true)
  })
})

describe('autoOrganize', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('analyzes then confirms every draft', async () => {
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
      const url = new URL(input)
      calls.push({ path: url.pathname, method: options.method || 'GET' })
      if (url.pathname.endsWith('/analyze/')) {
        return jsonResponse({ note: { id: 1, revision: 1 }, items: [draft], domains: [], analysis_running: false })
      }
      if (url.pathname.endsWith('/confirm-analysis/')) {
        return jsonResponse({ note: { id: 1, revision: 2 }, items: [{ ...draft, is_confirmed: true }], domains: [], analysis_running: false })
      }
      return jsonResponse({})
    }))
    const result = await autoOrganize({ id: 1, revision: 0 }, { trial: true })
    expect(result.status).toBe('confirmed')
    expect(calls.filter((call) => call.path.endsWith('/analyze/'))).toHaveLength(1)
    expect(calls.filter((call) => call.path.endsWith('/confirm-analysis/'))).toHaveLength(1)
  })

  it('reports no-drafts without confirming', async () => {
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = new URL(input)
      calls.push(url.pathname)
      return jsonResponse({ note: { id: 1, revision: 1 }, items: [], domains: [], analysis_running: false })
    }))
    const result = await autoOrganize({ id: 1, revision: 0 }, { trial: true })
    expect(result.status).toBe('no-drafts')
    expect(calls.some((path) => path.endsWith('/confirm-analysis/'))).toBe(false)
  })
})
