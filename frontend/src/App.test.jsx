import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
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
    if (path.endsWith('/items/')) return jsonResponse([])
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
    await user.type(screen.getByLabelText(/email or username/i), 'maya@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument()
    await user.clear(screen.getByLabelText(/^password$/i))
    await user.type(screen.getByLabelText(/^password$/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByRole('heading', { name: /good morning, maya rahman/i })).toBeInTheDocument()
  })

  it('registers and logs out through the API', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await user.type(screen.getByLabelText('Name'), 'Maya Rahman')
    await user.type(screen.getByLabelText('Email'), 'maya@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.type(screen.getByLabelText('Confirm password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('heading', { name: /good morning, maya rahman/i })).toBeInTheDocument()
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
    expect(await screen.findByRole('heading', { name: /^notes$/i })).toBeInTheDocument()
    expect(screen.queryByText('Buy coffee tomorrow')).not.toBeInTheDocument()
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
    await user.type(screen.getByLabelText(/email or username/i), 'bob@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByRole('heading', { name: /good morning, bob user/i })).toBeInTheDocument()
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

  it('starts with a folded menu that opens only when toggled', async () => {
    state.authenticated = true
    const user = userEvent.setup()
    renderApp('/app')
    const toggle = await screen.findByRole('button', { name: 'Open menu' })
    expect(document.querySelector('.sidebar.closed')).toBeInTheDocument()
    await user.click(toggle)
    expect(await screen.findByRole('button', { name: 'Close menu' })).toBeInTheDocument()
    expect(document.querySelector('.sidebar.open')).toBeInTheDocument()
  })

  it('renders all protected application pages for an authenticated user', async () => {
    state.authenticated = true
    const routes = [
      ['/app', /good morning/i], ['/app/notes', /^notes$/i], ['/app/notes/new', /^new note$/i],
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
