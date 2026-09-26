import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { resolveLinkedTransaction } from './features/items/ItemPages'
import { AiKeyContext } from './context/AiKeyContext'
import { setAccessToken } from './api/http'
import { installSupabaseMock } from './test/supabaseMock'
import { AppStateProvider } from './context/AppStateContext'
import { AuthProvider } from './context/AuthContext'
import { NotesProvider } from './context/NotesContext'

const mayaProfile = { id: '11111111-1111-4111-8111-111111111111', username: 'maya@example.com', email: 'maya@example.com', name: 'Maya Rahman' }
const defaultPrefs = {
  notification_enabled: false,
  time_reminders_enabled: false,
  location_reminders_enabled: false,
  daily_briefing_enabled: true,
  week_starts_on: 0,
}
const state = {
  authenticated: false,
  profile: mayaProfile,
  prefs: { ...defaultPrefs },
  notes: [],
  nextId: 2,
  failNotes: false,
  delayNotes: false,
  failLogin: false,
}

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  }))
}

function notePayload(note) {
  return {
    id: note.id,
    raw_text: note.raw_text,
    processing_status: 'UNPROCESSED',
    is_archived: false,
    created_at: note.created_at || '2026-09-21T08:00:00Z',
    updated_at: note.updated_at || '2026-09-21T08:00:00Z'
  }
}

function installApiMock() {
  vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
    const url = new URL(input)
    const path = url.pathname
    const method = options.method || 'GET'

    if (path.endsWith('/auth/me/')) {
      if (!state.authenticated) return jsonResponse({ detail: 'Authentication required.' }, 401)
      if (method === 'PATCH') state.profile = { ...state.profile, ...JSON.parse(options.body) }
      return jsonResponse(state.profile)
    }
    if (path.endsWith('/auth/preferences/')) {
      if (!state.authenticated) return jsonResponse({ detail: 'Authentication required.' }, 401)
      if (method === 'PATCH') state.prefs = { ...state.prefs, ...JSON.parse(options.body) }
      return jsonResponse({ ...state.prefs })
    }
    if (path.endsWith('/auth/preferences/reset/')) {
      if (!state.authenticated) return jsonResponse({ detail: 'Authentication required.' }, 401)
      state.prefs = { ...defaultPrefs }
      state.profile = { ...state.profile, display_name: '', timezone: 'Asia/Dhaka', default_currency: 'BDT' }
      return jsonResponse({ user: state.profile, preferences: { ...state.prefs } })
    }
    if (path.endsWith('/auth/settings/')) {
      if (!state.authenticated) return jsonResponse({ detail: 'Authentication required.' }, 401)
      return jsonResponse({ user: state.profile, preferences: { ...state.prefs } })
    }
    if (path.endsWith('/items/')) {
      const type = url.searchParams.get('type')
      return jsonResponse((state.itemsList || []).filter((item) => !type || item.item_type === type))
    }
    const itemMatch = path.match(/\/items\/(\d+)\/$/)
    if (itemMatch && method === 'PATCH') {
      const item = (state.itemsList || []).find((entry) => String(entry.id) === itemMatch[1])
      if (!item) return jsonResponse({ detail: 'Not found.' }, 404)
      Object.assign(item, JSON.parse(options.body))
      return jsonResponse(item)
    }
    if (path.endsWith('/transactions/summary/')) return jsonResponse(state.txSummary || { currencies: [] })
    if (path.endsWith('/transactions/')) {
      if (method === 'POST') {
        const created = { id: `tx-${(state.transactions || []).length + 1}`, ...JSON.parse(options.body) }
        state.transactions = [...(state.transactions || []), created]
        return jsonResponse(created, 201)
      }
      const noteItem = url.searchParams.get('note_item')
      return jsonResponse((state.transactions || []).filter((row) => !noteItem || String(row.note_item) === String(noteItem)))
    }
    const txMatch = path.match(/\/transactions\/(.+)\/$/)
    if (txMatch && method === 'DELETE' && !path.endsWith('/transactions/summary/')) {
      state.transactions = (state.transactions || []).filter((row) => String(row.id) !== txMatch[1])
      return jsonResponse(null, 204)
    }
    if (path.endsWith('/search/answer/') && method === 'POST') {
      const body = JSON.parse(options.body)
      return jsonResponse({
        query: body.query, mode: 'grounded', answer: `Grounded answer for ${body.query}.`,
        sources: ['7'], results: [{
          kind: 'NOTE_ITEM', id: 7, title: 'Mocked lecture notes',
          excerpt: 'Mocked excerpt about the query.', source_note_id: '1',
          relevance: 5, metadata: { item_type: 'TASK', domains: ['education'], status: 'PENDING' },
        }],
      })
    }
    if (path.endsWith('/search/') && method === 'POST') {
      const body = JSON.parse(options.body)
      return jsonResponse({
        query: body.query, mode: 'lexical', parsed: {}, results: [{
          kind: 'NOTE_ITEM', id: 7, title: 'Mocked lecture notes',
          excerpt: 'Mocked excerpt about the query.', source_note_id: '1',
          relevance: 5, metadata: { item_type: 'TASK', domains: ['education'], status: 'PENDING' },
        }],
      })
    }
    if (path.endsWith('/review/')) {
      const note = state.notes.find((item) => item.id === Number(path.split('/').at(-3)))
      return jsonResponse({ note: { ...notePayload(note), revision: 0 }, items: [], domains: [], analysis_running: false })
    }

    if (path.endsWith('/notes/') && method === 'GET') {
      if (state.delayNotes) await new Promise((resolve) => setTimeout(resolve, 50))
      if (state.failNotes) return jsonResponse({ detail: 'Notes are temporarily unavailable.' }, 503)
      return jsonResponse(state.notes.map(notePayload))
    }
    if (path.endsWith('/notes/') && method === 'POST') {
      const body = JSON.parse(options.body)
      const note = { id: state.nextId++, raw_text: body.raw_text, created_at: '2026-09-21T09:00:00Z' }
      state.notes.unshift(note)
      return jsonResponse(notePayload(note), 201)
    }

    const analyzeMatch = path.match(/\/notes\/(\d+)\/analyze\/$/)
    if (analyzeMatch && method === 'POST') {
      const id = Number(analyzeMatch[1])
      state.analyzedNoteIds = [...(state.analyzedNoteIds || []), id]
      if (state.failAnalyze) return jsonResponse({ detail: 'AI organization failed. Your note is saved.' }, 502)
      const note = state.notes.find((item) => item.id === id)
      if (!note) return jsonResponse({ detail: 'Not found.' }, 404)
      return jsonResponse({ note: { ...notePayload(note), revision: 0 }, items: state.analyzeItems || [], domains: [], analysis_running: false })
    }

    const confirmMatch = path.match(/\/notes\/(\d+)\/confirm-analysis\/$/)
    if (confirmMatch && method === 'POST') {
      const body = JSON.parse(options.body)
      state.confirmedPayload = body
      const id = Number(confirmMatch[1])
      const confirmed = (body.items || []).map((item, index) => ({
        id: item.id || 100 + index, item_type: item.item_type, title: item.title,
        summary: item.summary || '', normalized_text: item.normalized_text || '',
        domains: item.domains || [], status: 'PENDING', importance: item.importance || 'NORMAL',
        start_date: item.start_date || null, due_date: item.due_date || null,
        start_datetime: null, due_datetime: null, amount: item.amount ?? null,
        currency: item.currency || null, quantity: null, unit: null, place_hint: null,
        is_confirmed: true, note: id, revision: 1,
      }))
      state.itemsList = [...(state.itemsList || []), ...confirmed]
      const note = state.notes.find((item) => item.id === id)
      return jsonResponse({ note: { ...notePayload(note), revision: 1 }, items: confirmed, domains: [], analysis_running: false })
    }

    const match = path.match(/\/notes\/(\d+)\/$/)
    if (match) {
      const id = Number(match[1])
      const index = state.notes.findIndex((note) => note.id === id)
      if (index < 0) return jsonResponse({ detail: 'Not found.' }, 404)
      if (method === 'GET') {
        if (state.failNoteDetail > 0) {
          state.failNoteDetail -= 1
          return jsonResponse({ detail: 'Note is temporarily unavailable.' }, 503)
        }
        return jsonResponse(notePayload(state.notes[index]))
      }
      if (method === 'PATCH') {
        state.notes[index] = { ...state.notes[index], raw_text: JSON.parse(options.body).raw_text }
        return jsonResponse(notePayload(state.notes[index]))
      }
      if (method === 'DELETE') {
        state.notes.splice(index, 1)
        return jsonResponse(null, 204)
      }
    }

    throw new Error(`Unhandled API request: ${method} ${path}`)
  }))
}

function renderApp(path = '/') {
  window.history.pushState({}, '', path)
  return render(
    <AuthProvider>
      <NotesProvider>
        <AppStateProvider><App /></AppStateProvider>
      </NotesProvider>
    </AuthProvider>
  )
}

function renderAppWithTrial(path = '/') {
  window.history.pushState({}, '', path)
  return render(
    <AiKeyContext.Provider value={{ groqApiKey: '', setGroqApiKey: () => {}, clearGroqApiKey: () => {}, trialActive: true, startTrial: () => {}, endTrial: () => {} }}>
      <AuthProvider>
        <NotesProvider>
          <AppStateProvider><App /></AppStateProvider>
        </NotesProvider>
      </AuthProvider>
    </AiKeyContext.Provider>
  )
}

describe('Part 2 full-stack UI flows', () => {
  beforeEach(() => {
    state.authenticated = false
    state.profile = mayaProfile
    state.prefs = { ...defaultPrefs }
    state.notes = [{ id: 1, raw_text: 'Buy eggs.', created_at: '2026-09-21T08:00:00Z' }]
    state.nextId = 2
    state.failNotes = false
    state.delayNotes = false
    state.failNoteDetail = 0
    state.failAnalyze = false
    state.itemsList = []
    state.analyzeItems = []
    state.analyzedNoteIds = []
    state.confirmedPayload = null
    state.transactions = []
    state.txSummary = null
    state.failLogin = false
    setAccessToken(null)
    window.history.pushState({}, '', '/')
    installSupabaseMock(state)
    installApiMock()
  })

  it('redirects unauthenticated protected routes to login', async () => {
    renderApp('/app/notes')
    expect(screen.getByText(/checking your session/i)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('validates login, reports API errors, and opens the dashboard', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(await screen.findByRole('button', { name: /log in/i }))
    expect(screen.getByText(/enter your email and password/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^email$/i), 'maya@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument()
    await user.clear(screen.getByLabelText(/^password$/i))
    await user.type(screen.getByLabelText(/^password$/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByRole('heading', { name: /good (morning|afternoon|evening|night), maya rahman/i })).toBeInTheDocument()
  })

  it('registers and logs out through the API', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await user.type(screen.getByLabelText('Name'), 'Maya Rahman')
    await user.type(screen.getByLabelText('Email'), 'maya@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.type(screen.getByLabelText('Confirm password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('heading', { name: /good (morning|afternoon|evening|night), maya rahman/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /log out/i }))
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('restores a session and creates, edits, and deletes a persisted note', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/app/notes')
    expect(await screen.findByText('Buy eggs.')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /new note/i }))
    await user.type(screen.getByLabelText(/your thought/i), 'Buy coffee from Agora')
    await user.click(screen.getByRole('button', { name: /save note/i }))
    expect(await screen.findByRole('heading', { name: /captured thought/i })).toBeInTheDocument()
    expect(screen.getByText('Buy coffee from Agora')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const editor = screen.getByDisplayValue('Buy coffee from Agora')
    await user.clear(editor)
    await user.type(editor, 'Buy coffee tomorrow')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText('Buy coffee tomorrow')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('heading', { name: /all notes/i })).toBeInTheDocument()
    expect(screen.queryByText('Buy coffee tomorrow')).not.toBeInTheDocument()
  })

  it('accepts 300 words and rejects 301 words', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/app/notes/new')
    const editor = await screen.findByLabelText(/your thought/i)
    fireEvent.change(editor, { target: { value: Array(301).fill('word').join(' ') } })
    expect(screen.getByText('301/300 words')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /save note/i }))
    expect(screen.getByText(/keep notes to 300 words or fewer/i)).toBeInTheDocument()
    await user.clear(editor)
    fireEvent.change(editor, { target: { value: Array(300).fill('word').join(' ') } })
    await user.click(screen.getByRole('button', { name: /save note/i }))
    expect(await screen.findByRole('heading', { name: /captured thought/i })).toBeInTheDocument()
  })

  it('auto-organizes a quick-captured note when trial is active', async () => {
    state.authenticated = true
    state.notes = []
    state.itemsList = []
    state.analyzeItems = [{
      id: 11, item_type: 'TASK', title: 'File taxes', summary: '', normalized_text: 'File taxes',
      domains: ['finance'], status: 'PENDING', importance: 'NORMAL',
      start_date: null, due_date: '2026-09-26', start_datetime: null, due_datetime: null,
      amount: null, currency: null, quantity: null, unit: null, place_hint: null,
      confidence: 0.9, is_confirmed: false, note: 2, revision: 1,
    }]
    const user = userEvent.setup()
    renderAppWithTrial('/app')
    await user.type(await screen.findByLabelText(/what do you want to remember/i), 'File taxes Friday')
    await user.click(screen.getByRole('button', { name: /^save note/i }))
    await waitFor(() => expect(state.confirmedPayload).not.toBeNull())
    expect(await screen.findByText(/saved and organized/i)).toBeInTheDocument()
    const analyzes = fetch.mock.calls.filter(([url, options]) => /\/notes\/\d+\/analyze\/$/.test(new URL(url).pathname) && options?.method === 'POST')
    expect(analyzes).toHaveLength(1)
  })

  it('saves without organizing when AI is not configured', async () => {
    state.authenticated = true
    state.notes = []
    state.itemsList = []
    const user = userEvent.setup()
    renderApp('/app')
    await user.type(await screen.findByLabelText(/what do you want to remember/i), 'File taxes Friday')
    await user.click(screen.getByRole('button', { name: /^save note/i }))
    expect(await screen.findByText(/saved as an unprocessed note/i)).toBeInTheDocument()
    const analyzes = fetch.mock.calls.filter(([url, options]) => /\/notes\/\d+\/analyze\/$/.test(new URL(url).pathname) && options?.method === 'POST')
    expect(analyzes).toHaveLength(0)
  })

  it('shows Notes API loading and error states', async () => {
    state.authenticated = true
    state.failNotes = true
    state.delayNotes = true
    renderApp('/app/notes')
    expect(await screen.findByText(/loading your notes/i)).toBeInTheDocument()
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
  })

  it('shows a retry action when a note fails to load, then recovers', async () => {
    state.authenticated = true
    state.failNoteDetail = 1
    const user = userEvent.setup()
    renderApp('/app/notes/1')
    expect(await screen.findByRole('heading', { name: /couldn't load this note/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByRole('heading', { name: /captured thought/i })).toBeInTheDocument()
    expect(screen.getByText('Buy eggs.')).toBeInTheDocument()
  })

  it('analyzes a note on the spot from the note peek popup', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/app/notes')
    await user.click(await screen.findByRole('button', { name: /open note: buy eggs\./i }))
    await user.click(await screen.findByRole('button', { name: /analyze buy eggs\./i }))
    expect(await screen.findByRole('heading', { name: /captured thought/i })).toBeInTheDocument()
    expect(state.analyzedNoteIds).toEqual([1])
  })

  it('shows due-today tasks on the dashboard instead of recently captured notes', async () => {
    state.authenticated = true
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    state.notes = [
      { id: 1, raw_text: 'Fresh thought from today', created_at: now.toISOString() },
      { id: 2, raw_text: 'Old thought from weeks ago', created_at: '2026-09-01T08:00:00Z' },
    ]
    state.itemsList = [
      { id: 11, item_type: 'TASK', title: 'Submit the report', status: 'PENDING', due_date: today, domains: ['work'], note: 2, revision: 0 },
    ]
    state.txSummary = { currencies: [] }
    renderApp('/app')
    const tasksCard = await screen.findByRole('region', { name: "Today's tasks" })
    expect(within(tasksCard).getByText('Submit the report')).toBeInTheDocument()
    expect(tasksCard).not.toHaveTextContent('Fresh thought from today')
    expect(tasksCard).not.toHaveTextContent('Old thought from weeks ago')
    expect(screen.queryByText('৳250')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recent notes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Processing queue' })).toBeInTheDocument()
  })

  it('filters notes locally with the category dropdown', async () => {
    state.authenticated = true
    state.notes = [
      { id: 1, raw_text: 'Buy eggs from Agora', created_at: '2026-09-21T08:00:00Z' },
      { id: 2, raw_text: 'Team standup at ten', created_at: '2026-09-20T08:00:00Z' },
    ]
    state.itemsList = [
      { id: 11, item_type: 'TASK', title: 'Buy eggs', status: 'PENDING', domains: ['shopping'], note: 1, revision: 0 },
    ]
    const user = userEvent.setup()
    renderApp('/app/notes')
    expect(await screen.findByRole('button', { name: /open note: buy eggs from agora/i })).toBeInTheDocument()
    await screen.findByRole('option', { name: /shopping \(1\)/i })
    await user.selectOptions(screen.getByLabelText('Category'), 'events')
    expect(screen.queryByRole('button', { name: /open note: buy eggs from agora/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open note: team standup at ten/i })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Category'), 'shopping')
    expect(screen.getByRole('button', { name: /open note: buy eggs from agora/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open note: team standup at ten/i })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Category'), 'all')
    expect(screen.getByRole('button', { name: /open note: team standup at ten/i })).toBeInTheDocument()
  })

  it('resolveLinkedTransaction finds the ledger row without trusting memory', async () => {
    state.authenticated = true
    state.transactions = [{ id: 'tx-9', note_item: 21, direction: 'DEBIT', amount: '100.00', currency: 'BDT', label: 'Buy shampoo' }]
    renderApp('/app/notes')
    await screen.findByRole('heading', { name: /all notes/i })
    await expect(resolveLinkedTransaction({ id: 21 })).resolves.toBe('tx-9')
    await expect(resolveLinkedTransaction({ id: 999 })).resolves.toBeNull()
  })

  it('auto analyze+confirms a backlog note on tick when trial is active', async () => {
    state.authenticated = true
    state.notes = [{ id: 1, raw_text: 'File taxes Friday', created_at: '2026-09-21T08:00:00Z' }]
    state.itemsList = []
    state.analyzeItems = [{
      id: 11, item_type: 'TASK', title: 'File taxes', summary: '', normalized_text: 'File taxes',
      domains: ['finance'], status: 'PENDING', importance: 'NORMAL',
      start_date: null, due_date: '2026-09-26', start_datetime: null, due_datetime: null,
      amount: null, currency: null, quantity: null, unit: null, place_hint: null,
      confidence: 0.9, is_confirmed: false, note: 1, revision: 1,
    }]
    const user = userEvent.setup()
    renderAppWithTrial('/app/notes')
    await user.click(await screen.findByRole('button', { name: /analyze and confirm file taxes friday automatically/i }))
    await waitFor(() => expect(state.confirmedPayload).not.toBeNull())
    expect(state.confirmedPayload.items).toHaveLength(1)
    expect(state.confirmedPayload.items[0]).toMatchObject({ item_type: 'TASK', title: 'File taxes', due_date: '2026-09-26' })
    expect(await screen.findByRole('option', { name: /tasks \(1\)/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the peek modal instead of auto-running without credentials', async () => {
    state.authenticated = true
    state.notes = [{ id: 1, raw_text: 'File taxes Friday', created_at: '2026-09-21T08:00:00Z' }]
    state.itemsList = []
    state.analyzeItems = []
    const user = userEvent.setup()
    renderApp('/app/notes')
    await user.click(await screen.findByRole('button', { name: /analyze and confirm file taxes friday automatically/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    const analyzes = fetch.mock.calls.filter(([url, options]) => /\/notes\/\d+\/analyze\/$/.test(new URL(url).pathname) && options?.method === 'POST')
    expect(analyzes).toHaveLength(0)
  })

  it('shows an inline error instead of silently opening the peek modal on auto failure', async () => {
    state.authenticated = true
    state.failAnalyze = true
    state.notes = [{ id: 1, raw_text: 'File taxes Friday', created_at: '2026-09-21T08:00:00Z' }]
    state.itemsList = []
    const user = userEvent.setup()
    renderAppWithTrial('/app/notes')
    await user.click(await screen.findByRole('button', { name: /analyze and confirm file taxes friday automatically/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/ai organization failed/i)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(state.confirmedPayload).toBeNull()
  })

  it('sends a single analyze request on rapid double clicks of the auto button', async () => {
    state.authenticated = true
    state.notes = [{ id: 1, raw_text: 'File taxes Friday', created_at: '2026-09-21T08:00:00Z' }]
    state.itemsList = []
    state.analyzeItems = []
    renderAppWithTrial('/app/notes')
    const button = await screen.findByRole('button', { name: /analyze and confirm file taxes friday automatically/i })
    // Synchronous double dispatch: a state-only guard would let both through.
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => {
      const analyzes = fetch.mock.calls.filter(([url, options]) => /\/notes\/\d+\/analyze\/$/.test(new URL(url).pathname) && options?.method === 'POST')
      expect(analyzes).toHaveLength(1)
    })
  })

  it('does not flash loading skeletons when ticking', async () => {
    state.authenticated = true
    state.notes = [{ id: 1, raw_text: 'File taxes Friday', created_at: '2026-09-21T08:00:00Z' }]
    state.itemsList = [
      { id: 21, item_type: 'TASK', title: 'File taxes', status: 'PENDING', due_date: '2026-09-26', domains: ['finance'], note: 1, revision: 0 },
    ]
    const user = userEvent.setup()
    renderApp('/app/notes')
    await user.selectOptions(await screen.findByLabelText('Category'), 'tasks')
    await user.click(await screen.findByRole('button', { name: 'Mark File taxes complete' }))
    expect(await screen.findByRole('button', { name: 'Mark File taxes incomplete' })).toBeInTheDocument()
    expect(document.querySelector('.note-skeleton')).toBeNull()
  })

  it('grays out a card when its item is ticked and restores on untick', async () => {
    state.authenticated = true
    state.notes = [{ id: 1, raw_text: 'File taxes Friday', created_at: '2026-09-21T08:00:00Z' }]
    state.itemsList = [
      { id: 21, item_type: 'TASK', title: 'File taxes', status: 'PENDING', due_date: '2026-09-26', domains: ['finance'], note: 1, revision: 0 },
    ]
    const user = userEvent.setup()
    renderApp('/app/notes')
    await user.selectOptions(await screen.findByLabelText('Category'), 'tasks')
    const card = await screen.findByRole('button', { name: /open note: file taxes friday/i })
    expect(card.closest('article')).not.toHaveClass('done')
    await user.click(await screen.findByRole('button', { name: 'Mark File taxes complete' }))
    await waitFor(() => expect(card.closest('article')).toHaveClass('done'))
    await user.click(await screen.findByRole('button', { name: 'Mark File taxes incomplete' }))
    await waitFor(() => expect(card.closest('article')).not.toHaveClass('done'))
  })

  it('ticks a single-item All card and records shopping expenses symmetrically', async () => {
    state.authenticated = true
    state.notes = [{ id: 1, raw_text: 'Bought shampoo', created_at: '2026-09-21T08:00:00Z' }]
    state.itemsList = [
      { id: 21, item_type: 'TASK', title: 'Buy shampoo', status: 'PENDING', domains: ['shopping'], amount: '100.00', currency: 'BDT', note: 1, revision: 0 },
    ]
    const user = userEvent.setup()
    renderApp('/app/notes')
    const card = await screen.findByRole('button', { name: /open note: bought shampoo/i })
    await user.click(await screen.findByRole('button', { name: 'Mark Buy shampoo complete' }))
    expect(await screen.findByRole('button', { name: 'Mark Buy shampoo incomplete' })).toBeInTheDocument()
    await waitFor(() => expect(card.closest('article')).toHaveClass('done'))
    expect(state.transactions).toHaveLength(1)
    expect(state.transactions[0]).toMatchObject({ note_item: 21, direction: 'DEBIT' })
    await user.click(screen.getByRole('button', { name: 'Mark Buy shampoo incomplete' }))
    expect(await screen.findByRole('button', { name: 'Mark Buy shampoo complete' })).toBeInTheDocument()
    await waitFor(() => expect(state.transactions).toHaveLength(0))
    await waitFor(() => expect(card.closest('article')).not.toHaveClass('done'))
  })

  it('ticks a task row inside the notes Tasks tab', async () => {
    state.authenticated = true
    state.notes = [{ id: 1, raw_text: 'File taxes Friday', created_at: '2026-09-21T08:00:00Z' }]
    state.itemsList = [
      { id: 21, item_type: 'TASK', title: 'File taxes', status: 'PENDING', due_date: '2026-09-26', domains: ['finance'], note: 1, revision: 0 },
    ]
    const user = userEvent.setup()
    renderApp('/app/notes')
    await user.selectOptions(await screen.findByLabelText('Category'), 'tasks')
    await user.click(await screen.findByRole('button', { name: 'Mark File taxes complete' }))
    expect(await screen.findByRole('button', { name: 'Mark File taxes incomplete' })).toBeInTheDocument()
    expect(state.itemsList[0].status).toBe('COMPLETED')
  })

  it('opens a tick popup for multi-item cards and ticks each element inside', async () => {
    state.authenticated = true
    state.notes = [{ id: 1, raw_text: 'Trip prep', created_at: '2026-09-21T08:00:00Z' }]
    state.itemsList = [
      { id: 21, item_type: 'TASK', title: 'Book tickets', status: 'PENDING', due_date: '2026-09-26', domains: ['travel'], note: 1, revision: 0 },
      { id: 22, item_type: 'TASK', title: 'Pack bags', status: 'PENDING', due_date: '2026-09-26', domains: ['travel'], note: 1, revision: 0 },
    ]
    const user = userEvent.setup()
    renderApp('/app/notes')
    await user.selectOptions(await screen.findByLabelText('Category'), 'tasks')
    expect(screen.queryByRole('button', { name: 'Mark Book tickets complete' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /choose items to tick in trip prep/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Tick items in this note')).toBeInTheDocument()
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(document.body.style.overflow).toBe('hidden')
    await user.click(within(dialog).getByRole('button', { name: 'Mark Book tickets complete' }))
    expect(await within(dialog).findByRole('button', { name: 'Mark Book tickets incomplete' })).toBeInTheDocument()
    expect(state.itemsList[0].status).toBe('COMPLETED')
    expect(state.itemsList[1].status).toBe('PENDING')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })

  it('keeps the grounded Ask page usable', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/app/search')
    await user.click(await screen.findByRole('button', { name: /ask my notes/i }))
    expect(screen.getByRole('heading', { name: /ask a grounded question/i })).toBeInTheDocument()
  })

  it('clears and reloads Notes when the authenticated account changes', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(screen.getByLabelText(/^email$/i), 'bob@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByRole('heading', { name: /good (morning|afternoon|evening|night), bob user/i })).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: /notes$/i })[0])
    expect(await screen.findByText('Bob private note')).toBeInTheDocument()
    expect(screen.queryByText('Buy eggs.')).not.toBeInTheDocument()
  })

  it('returns a generic password-reset request response', async () => {
    const user = userEvent.setup()
    renderApp('/forgot-password')
    await user.type(screen.getByLabelText('Email'), 'unknown@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(await screen.findByText(/if the account exists/i)).toBeInTheDocument()
  })

  it('saves preferences through the API', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/app/settings')
    const briefing = await screen.findByLabelText('Daily briefing')
    expect(briefing).toBeChecked()
    await user.click(briefing)
    await user.click(screen.getByRole('button', { name: /save preferences/i }))
    expect(await screen.findByText('Preferences saved')).toBeInTheDocument()
    expect(state.prefs.daily_briefing_enabled).toBe(false)
    const patches = fetch.mock.calls.filter(
      ([url, options]) => url.endsWith('/auth/preferences/') && options?.method === 'PATCH',
    )
    expect(patches).toHaveLength(1)
    expect(JSON.parse(patches[0][1].body).daily_briefing_enabled).toBe(false)
  })

  it('resets preferences to defaults through the API', async () => {
    state.authenticated = true
    state.prefs = { ...defaultPrefs, daily_briefing_enabled: false, week_starts_on: 5 }
    const user = userEvent.setup()
    renderApp('/app/settings')
    await screen.findByRole('button', { name: /save preferences/i })
    await user.click(screen.getByRole('button', { name: /reset to defaults/i }))
    expect(await screen.findByText('Preferences reset to defaults')).toBeInTheDocument()
    expect(state.prefs).toEqual(defaultPrefs)
    expect(fetch.mock.calls.some(([url, options]) => url.endsWith('/auth/preferences/reset/') && options?.method === 'POST')).toBe(true)
  })

  it('toggles password visibility on the login form', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    const password = await screen.findByLabelText(/^password$/i)
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide' }))
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password')
  })

  it('opens the sidebar on hover without a menu button', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/app')
    await screen.findByRole('heading', { name: /good (morning|afternoon|evening|night)/i })
    const sidebar = document.querySelector('.sidebar')
    expect(document.querySelector('.sidebar.closed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open menu|close menu/i })).not.toBeInTheDocument()
    await user.hover(sidebar)
    await waitFor(() => expect(document.querySelector('.sidebar.open')).toBeInTheDocument())
    await user.unhover(sidebar)
    await waitFor(() => expect(document.querySelector('.sidebar.closed')).toBeInTheDocument())
  })

  it('sends the profile block to settings and offers header search', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/app')
    const unlock = await screen.findByRole('button', { name: /unlock pro/i })
    const sidebarBottom = unlock.closest('.sidebar-bottom')
    expect(sidebarBottom.textContent).toMatch(/Unlock Pro.*Log out/s)
    expect(document.querySelector('.header-search')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /global search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^notifications$/i })).toBeInTheDocument()
    expect(document.querySelector('.topbar .theme-toggle[role="switch"]')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /signed in as/i }))
    expect(await screen.findByRole('heading', { name: /^settings$/i })).toBeInTheDocument()
  })

  it('routes header search to the search page and executes it', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/app')
    const box = await screen.findByRole('searchbox', { name: /global search/i })
    expect(box.closest('.retro-search')).toBeInTheDocument()
    expect(screen.getByText('⌘K')).toBeInTheDocument()
    await user.type(box, 'exam time{enter}')
    expect(await screen.findByText('Mocked lecture notes')).toBeInTheDocument()
    expect(screen.getByText('Lexical matches')).toBeInTheDocument()
    const answerCalls = fetch.mock.calls.filter(([url, options]) => new URL(url).pathname.endsWith('/search/answer/') && options?.method === 'POST')
    expect(answerCalls).toHaveLength(0)
  })

  it('auto-runs a shared ?q= link without another click', async () => {
    state.authenticated = true
    renderApp('/app/search?q=university')
    expect(await screen.findByText('Mocked lecture notes')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /search your notes/i })).toHaveValue('university')
  })

  it('auto-asks on the Ask tab when a query is present', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/app/search?q=fees')
    await user.click(await screen.findByRole('button', { name: /ask my notes/i }))
    expect(await screen.findByText('Grounded answer for fees.')).toBeInTheDocument()
    const sourceLink = await screen.findByRole('link', { name: 'Mocked lecture notes' })
    expect(sourceLink).toHaveAttribute('href', '/app/notes/1')
    expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument()
    expect(screen.queryByText('Matching context')).not.toBeInTheDocument()
  })

  it('renders all protected application pages for an authenticated user', async () => {
    state.authenticated = true
    const routes = [
      ['/app', /good (morning|afternoon|evening|night)/i], ['/app/notes', /all notes/i], ['/app/notes/new', /^new note$/i],
      ['/app/tasks', /^tasks$/i], ['/app/events', /^events$/i], ['/app/shopping', /^shopping$/i],
      ['/app/expenses', /^expenses$/i], ['/app/places', /^places$/i], ['/app/search', /^search$/i], ['/app/settings', /^settings$/i]
    ]
    for (const [path, heading] of routes) {
      const view = renderApp(path)
      await waitFor(() => expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument())
      view.unmount()
    }
  })
})
