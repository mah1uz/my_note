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

const profile = { id: '11111111-1111-4111-8111-111111111111', username: 'maya@example.com', email: 'maya@example.com', name: 'Maya' }
const state = { authenticated: true, profile, notes: [] }
let bulkCalls

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function notePayload(id, raw_text, processing_status) {
  return { id, raw_text, processing_status, is_archived: false, created_at: '2026-09-21T08:00:00Z', updated_at: '2026-09-21T08:00:00Z' }
}

function installMock() {
  bulkCalls = []
  vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
    const url = new URL(input)
    const path = url.pathname
    if (path.endsWith('/auth/me/')) return jsonResponse(state.profile)
    if (path.endsWith('/items/')) return jsonResponse([])
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
    expect(screen.queryByText(/need processing/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /enable trial/i }))
    expect(await screen.findByText(/2 notes need processing/i)).toBeInTheDocument()
    expect(screen.queryByText(/ai organization is off/i)).not.toBeInTheDocument()
  })

  it('runs Analyze All with the trial flag and reports confirmations', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /enable trial/i }))
    await user.click((await screen.findAllByRole('button', { name: /analyze all/i }))[0])
    await waitFor(() => expect(bulkCalls.length).toBe(1))
    expect(bulkCalls[0].body).toEqual({ mode: 'analyze' })
    expect(bulkCalls[0].headers['X-Groq-Trial']).toBe('true')
    expect(await screen.findByText(/confirmed 1/i)).toBeInTheDocument()
  })

  it('runs Verify & Review immediately to draft for manual review', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /enable trial/i }))
    await user.click((await screen.findAllByRole('button', { name: /verify & review/i }))[0])
    await waitFor(() => expect(bulkCalls.length).toBe(1))
    expect(bulkCalls[0].body).toEqual({ mode: 'verify' })
  })

  it('sends the personal key instead of the trial flag when set', async () => {
    setAccessToken('test-access')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await processAll('verify', { apiKey: 'personal-session-key', trial: true })
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['X-Groq-Api-Key']).toBe('personal-session-key')
    expect(headers['X-Groq-Trial']).toBeUndefined()
  })
})
