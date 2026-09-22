import { vi } from 'vitest'

export const exampleItem = (overrides = {}) => ({
  id: 1, note: 1, revision: 1, item_type: 'TASK', title: 'Buy eggs',
  summary: '', normalized_text: 'Buy eggs', domains: ['shopping'],
  start_date: null, due_date: null, start_datetime: null, due_datetime: null,
  amount: null, currency: null, quantity: null, unit: null, place_hint: 'Agora',
  status: 'PENDING', importance: 'NORMAL', confidence: 0.94, is_confirmed: false,
  ...overrides
})

export function installPart3Mock() {
  const state = {
    note: { id: 1, raw_text: 'Tomorrow class, buy eggs, and spent 250 taka on books.', processing_status: 'UNPROCESSED', revision: 0,
      created_at: '2026-09-21T08:00:00Z', updated_at: '2026-09-21T08:00:00Z' },
    items: [], analysisItems: [exampleItem()], confirmedPayload: null,
    failAnalyze: false, failConfirm: false, failReview: false, failList: false, failPatch: false,
    analyzeWait: null, analysisRunning: false
  }
  const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  const review = () => ({ note: { ...state.note }, items: state.items.map((item) => ({ ...item, revision: state.note.revision })),
    domains: ['education', 'shopping', 'finance', 'work', 'other'].map((slug) => ({ slug, name: slug })), analysis_running: state.analysisRunning })
  vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
    const url = new URL(input)
    const path = url.pathname
    const body = options.body ? JSON.parse(options.body) : {}
    if (path.endsWith('/auth/me/')) return response({ id: '11111111-1111-4111-8111-111111111111', name: 'Maya', email: 'maya@example.com' })
    if (path.endsWith('/notes/')) return response([{ ...state.note }])
    if (path.endsWith('/notes/1/')) return response({ ...state.note })
    if (path.endsWith('/review/')) return state.failReview ? response({ detail: 'Review unavailable.' }, 503) : response(review())
    if (path.endsWith('/analyze/')) {
      if (state.analyzeWait) await state.analyzeWait
      state.note.revision++
      if (state.failAnalyze) {
        state.note.processing_status = 'FAILED'
        return response({ detail: 'AI organization failed. Your note is saved.', code: 'timeout' }, 504)
      }
      state.note.processing_status = 'REVIEW_REQUIRED'
      state.items = [...state.items.filter((item) => item.is_confirmed), ...state.analysisItems]
      return response(review())
    }
    if (path.endsWith('/confirm-analysis/')) {
      state.confirmedPayload = body
      if (state.failConfirm) return response({ items: [{ title: ['Check this title.'] }] }, 400)
      state.items = [...state.items.filter((item) => item.is_confirmed), ...body.items.map((item, index) => exampleItem({ ...item, id: item.id || 30 + index, is_confirmed: true }))]
      state.note.processing_status = 'PROCESSED'
      state.note.revision++
      return response(review())
    }
    if (path.endsWith('/items/')) {
      if (options.method === 'POST') {
        if (!body.title?.trim()) return response({ title: ['A title is required.'] }, 400)
        const created = exampleItem({ ...body, id: 40 + state.items.length, note: 1, revision: state.note.revision, is_confirmed: true, confidence: null })
        state.items.push(created)
        return response(created, 201)
      }
      if (state.failList) return response({ detail: 'Items unavailable.' }, 503)
      return response(state.items.filter((item) => item.is_confirmed &&
        (!url.searchParams.get('type') || item.item_type === url.searchParams.get('type')) &&
        (!url.searchParams.get('domain') || item.domains.includes(url.searchParams.get('domain'))) &&
        (!url.searchParams.get('status') || item.status === url.searchParams.get('status')))
        .map((item) => ({ ...item, revision: state.note.revision })))
    }
    if (/\/items\/\d+\/$/.test(path)) {
      if (state.failPatch) return response({ detail: 'This note changed. Reload the review before trying again.' }, 409)
      const item = state.items.find((entry) => entry.id === Number(path.split('/').at(-2)))
      Object.assign(item, body)
      state.note.revision++
      return response(item)
    }
    throw new Error(`Unhandled Part 3 mock: ${path}`)
  }))
  return state
}
