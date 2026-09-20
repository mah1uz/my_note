import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { setAccessToken } from './api/http'
import { AppStateProvider } from './context/AppStateContext'
import { AuthProvider } from './context/AuthContext'
import { NotesProvider } from './context/NotesContext'

const mayaProfile = { id: 1, username: 'maya', email: 'maya@example.com', name: 'Maya Rahman' }
let profile
let authenticated
let notes
let nextId
let failNotes
let delayNotes

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

    if (path.endsWith('/auth/refresh/')) return authenticated ? jsonResponse({ access: 'restored-access' }) : jsonResponse({ detail: 'No active session.' }, 401)
    if (path.endsWith('/auth/me/')) return authenticated ? jsonResponse(profile) : jsonResponse({ detail: 'Authentication required.' }, 401)
    if (path.endsWith('/auth/login/')) {
      const body = JSON.parse(options.body)
      if (body.password === 'wrong-password') return jsonResponse({ detail: 'Invalid credentials.' }, 401)
      if (body.identity === 'bob@example.com') {
        profile = { id: 2, username: 'bob', email: 'bob@example.com', name: 'Bob User' }
        notes = [{ id: 9, raw_text: 'Bob private note', created_at: '2026-09-21T10:00:00Z' }]
      }
      authenticated = true
      return jsonResponse({ access: 'login-access', user: profile })
    }
    if (path.endsWith('/auth/register/')) {
      authenticated = true
      return jsonResponse({ access: 'register-access', user: profile }, 201)
    }
    if (path.endsWith('/auth/logout/')) {
      authenticated = false
      return jsonResponse(null, 204)
    }
    if (path.endsWith('/auth/password-reset/')) return jsonResponse({ detail: 'If an account exists, a reset link has been prepared.' })

    if (path.endsWith('/notes/') && method === 'GET') {
      if (delayNotes) await new Promise((resolve) => setTimeout(resolve, 50))
      if (failNotes) return jsonResponse({ detail: 'Notes are temporarily unavailable.' }, 503)
      return jsonResponse(notes.map(notePayload))
    }
    if (path.endsWith('/notes/') && method === 'POST') {
      const body = JSON.parse(options.body)
      const note = { id: nextId++, raw_text: body.raw_text, created_at: '2026-09-21T09:00:00Z' }
      notes.unshift(note)
      return jsonResponse(notePayload(note), 201)
    }

    const match = path.match(/\/notes\/(\d+)\/$/)
    if (match) {
      const id = Number(match[1])
      const index = notes.findIndex((note) => note.id === id)
      if (index < 0) return jsonResponse({ detail: 'Not found.' }, 404)
      if (method === 'GET') return jsonResponse(notePayload(notes[index]))
      if (method === 'PATCH') {
        notes[index] = { ...notes[index], raw_text: JSON.parse(options.body).raw_text }
        return jsonResponse(notePayload(notes[index]))
      }
      if (method === 'DELETE') {
        notes.splice(index, 1)
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
    authenticated = false
    profile = mayaProfile
    notes = [{ id: 1, raw_text: 'Buy eggs.', created_at: '2026-09-21T08:00:00Z' }]
    nextId = 2
    failNotes = false
    delayNotes = false
    setAccessToken(null)
    window.history.pushState({}, '', '/')
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
    await user.click(screen.getByRole('button', { name: /log in/i }))
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
    authenticated = true
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
    authenticated = true
    failNotes = true
    delayNotes = true
    renderApp('/app/notes')
    expect(await screen.findByText(/loading your notes/i)).toBeInTheDocument()
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
  })

  it('keeps later feature pages mocked and usable', async () => {
    authenticated = true
    const user = userEvent.setup()
    renderApp('/app/tasks')
    const toggle = await screen.findByRole('button', { name: /mark buy eggs complete/i })
    await user.click(toggle)
    expect(screen.getByRole('button', { name: /mark buy eggs incomplete/i })).toBeInTheDocument()
  })

  it('clears and reloads Notes when the authenticated account changes', async () => {
    authenticated = true
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
    expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument()
  })

  it('renders all protected application pages for an authenticated user', async () => {
    authenticated = true
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
