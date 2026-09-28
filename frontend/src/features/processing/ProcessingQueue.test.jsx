import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { setAccessToken } from '../../api/http'
import { installSupabaseMock } from '../../test/supabaseMock'
import { AiKeyProvider, useAiKey } from '../../context/AiKeyContext'
import { AppStateProvider } from '../../context/AppStateContext'
import { AuthProvider } from '../../context/AuthContext'
import { NotesProvider } from '../../context/NotesContext'
import { backlogNotes, processAll, summarizeResults } from '../../api/processApi'

// Keep the real one-request-per-note queue, but skip the production 12-second
// pacing delay in UI tests. The actual pacing is tested in processApi.test.js.
vi.mock('../../api/processApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, analyzeBacklog: (credentials, options) => actual.analyzeBacklog(credentials, { ...options, spacingMs: 0 }) }
})

const profile = { id: '11111111-1111-4111-8111-111111111111', username: 'maya@example.com', email: 'maya@example.com', name: 'Maya' }
const state = { authenticated: true, profile, notes: [] }
let bulkCalls
let rateLimitedId

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function notePayload(id, raw_text, processing_status) {
  return { id, raw_text, processing_status, revision: 0, is_archived: false, created_at: '2026-09-21T08:00:00Z', updated_at: '2026-09-21T08:00:00Z' }
}

function installMock() {
  bulkCalls = []
  rateLimitedId = null
  vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
    const url = new URL(input)
    const path = url.pathname
    if (path.endsWith('/auth/me/')) return jsonResponse(state.profile)
    if (path.endsWith('/items/')) return jsonResponse([])
    if (path.endsWith('/confirm-analysis/')) {
      const id = Number(path.match(/\/notes\/(\d+)\//)[1])
      const note = state.notes.find((entry) => entry.id === id)
      note.processing_status = 'PROCESSED'
      return jsonResponse({ note: { ...note, revision: 2 }, items: [], domains: [] })
    }
    const analyzeMatch = path.match(/\/notes\/(\d+)\/analyze\/$/)
    if (analyzeMatch) {
      const id = Number(analyzeMatch[1])
      bulkCalls.push({ id, body: JSON.parse(options.body), headers: options.headers })
      if (id === rateLimitedId) return jsonResponse({ detail: 'Provider rate-limited.', code: 'rate_limit' }, 503)
      const note = state.notes.find((entry) => entry.id === id)
      note.processing_status = 'REVIEW_REQUIRED'
      return jsonResponse({ note: { ...note, revision: 1 }, items: [{ id, item_type: 'TASK', title: 'Remember', summary: '', normalized_text: 'Remember', domains: ['work'], status: 'PENDING', importance: 'NORMAL', start_date: null, due_date: null, start_datetime: null, due_datetime: null, amount: null, currency: null, quantity: null, unit: null, place_hint: null, is_confirmed: false }], domains: [], analysis_running: false })
    }
    if (path.endsWith('/notes/process-all/')) {
      const body = JSON.parse(options.body)
      bulkCalls.push({ body, headers: options.headers })
      const status = body.mode === 'analyze' ? 'confirmed' : 'analyzed'
      return jsonResponse({ mode: body.mode, results: [{ id: 1, status, code: 'ok' }], stopped: null })
    }
    if (path.endsWith('/notes/')) return jsonResponse(state.notes)
    if (path.endsWith('/review/')) {
      return jsonResponse({ note: { ...state.notes[0], revision: 0 }, items: [], domains: [], analysis_running: false })
    }
    return jsonResponse({})
  }))
}

function TrialStarter() {
  const { startTrial } = useAiKey()
  return <button onClick={startTrial}>enable trial</button>
}

function renderApp(path = '/app') {
  window.history.pushState({}, '', path)
  return render(
    <AiKeyProvider>
      <AuthProvider>
        <NotesProvider>
          <AppStateProvider>
            <TrialStarter />
            <App />
          </AppStateProvider>
        </NotesProvider>
      </AuthProvider>
    </AiKeyProvider>,
  )
}

describe('processing queue', () => {
  beforeEach(() => {
    setAccessToken(null)
    state.authenticated = true
    state.profile = profile
    state.notes = [
      notePayload(1, 'Unprocessed thought', 'UNPROCESSED'),
      notePayload(2, 'Failed thought', 'FAILED'),
      notePayload(3, 'Done thought', 'PROCESSED'),
    ]
    installSupabaseMock(state)
    installMock()
  })

  it('derives the backlog and summarizes bulk results without the network', () => {
    const normalized = [
      { id: '1', processingStatus: 'UNPROCESSED' },
      { id: '2', processingStatus: 'FAILED' },
      { id: '3', processingStatus: 'PROCESSED' },
    ]
    expect(backlogNotes(normalized).map((note) => note.id)).toEqual(['1', '2'])
    expect(backlogNotes([])).toEqual([])
    expect(summarizeResults({ mode: 'analyze', results: [{ status: 'confirmed' }, { status: 'failed', code: 'provider' }], stopped: 'trial_exhausted' }))
      .toEqual({ analyzed: 0, confirmed: 1, failed: 1, skipped: 0, total: 2, stopped: 'trial_exhausted', failures: ['provider'] })
  })

  it('prompts for AI setup until configured, then shows the backlog banner', async () => {
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByText(/ai organization is off/i)).toBeInTheDocument()
    expect(screen.queryByText(/need review/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /enable trial/i }))
    expect(await screen.findByText(/2 notes need review/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /verify & review/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /review in all notes/i })).toHaveLength(2)
    expect(screen.queryByText(/ai organization is off/i)).not.toBeInTheDocument()
  })

  it('only offers Analyze all now on the Notes page, not the dashboard', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /enable trial/i }))
    await screen.findByText(/2 notes need review/i)
    expect(screen.queryByRole('button', { name: /analyze all/i })).not.toBeInTheDocument()
  })

  it('runs Analyze all now sequentially with the trial flag and reports drafts', async () => {
    const user = userEvent.setup()
    renderApp('/app/notes')
    await user.click(screen.getByRole('button', { name: /enable trial/i }))
    await user.click(await screen.findByRole('button', { name: /analyze all now/i }))
    await waitFor(() => expect(bulkCalls.length).toBe(2))
    expect(bulkCalls.map((call) => call.id)).toEqual([1, 2])
    expect(bulkCalls[0].body).toEqual({ revision: 0 })
    expect(bulkCalls[0].headers['X-AI-Provider']).toBe('groq')
    expect(bulkCalls[0].headers['X-AI-Trial']).toBe('true')
    expect(await screen.findByText(/categorized 2/i)).toBeInTheDocument()
    expect(state.notes.slice(0, 2).every((note) => note.processing_status === 'PROCESSED')).toBe(true)
  })

  it('refreshes notes and confirmed categories after each automatic confirmation', async () => {
    const user = userEvent.setup()
    renderApp('/app/notes')
    await user.click(screen.getByRole('button', { name: /enable trial/i }))
    await screen.findByText(/2 notes need review/i)
    const itemsCalls = () => fetch.mock.calls.filter(([url]) => new URL(url).pathname === '/api/v1/items/').length
    const notesCalls = () => fetch.mock.calls.filter(([url]) => new URL(url).pathname === '/api/v1/notes/').length
    const before = itemsCalls()
    const beforeNotes = notesCalls()
    expect(before).toBeGreaterThan(0)
    await user.click(await screen.findByRole('button', { name: /analyze all now/i }))
    expect(await screen.findByText(/categorized 2/i)).toBeInTheDocument()
    await waitFor(() => expect(notesCalls()).toBeGreaterThan(beforeNotes))
    await waitFor(() => expect(itemsCalls()).toBeGreaterThan(before))
  })

  it('confirms safe drafts without requiring a second review', async () => {
    const user = userEvent.setup()
    renderApp('/app/notes')
    await user.click(screen.getByRole('button', { name: /enable trial/i }))
    await user.click(await screen.findByRole('button', { name: /analyze all now/i }))
    await waitFor(() => expect(bulkCalls.length).toBe(2))
    expect(bulkCalls.map((call) => call.id)).toEqual([1, 2])
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => /\/confirm-analysis\/$/.test(new URL(url).pathname))).toHaveLength(2))
  })

  it('stops on a provider rate limit, leaving later notes unattempted', async () => {
    rateLimitedId = 1
    const user = userEvent.setup()
    renderApp('/app/notes')
    await user.click(screen.getByRole('button', { name: /enable trial/i }))
    await user.click(await screen.findByRole('button', { name: /analyze all now/i }))
    expect(await screen.findByText(/stopped: provider rate-limited this run/i)).toBeInTheDocument()
    expect(bulkCalls.map((call) => call.id)).toEqual([1])
    expect(state.notes[1].processing_status).toBe('FAILED')
  })

  it('sends the personal key instead of the trial flag when set', async () => {
    setAccessToken('test-access')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await processAll('verify', { apiKey: 'personal-session-key', trial: true })
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['X-AI-Provider']).toBe('groq')
    expect(headers['X-AI-Api-Key']).toBe('personal-session-key')
    expect(headers['X-AI-Trial']).toBeUndefined()
  })
})
