import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeNote, confirmAnalysis, listItems } from '../api/itemsApi'
import { setAccessToken } from '../api/http'
import { AiKeyProvider, useAiKey } from '../context/AiKeyContext'
import AiProviderCard from './notes/AiProviderCard'

function KeyHarness() {
  const { groqApiKey, clearGroqApiKey } = useAiKey()
  return <>
    <span>{groqApiKey ? 'active' : 'inactive'}</span>
    <button onClick={clearGroqApiKey}>logout</button>
  </>
}

describe('session-only Groq BYOK', () => {
  afterEach(() => {
    setAccessToken(null)
    vi.unstubAllGlobals()
  })

  it('keeps the key in memory, masks it, clears it, and does not restore it after remount', async () => {
    const user = userEvent.setup()
    const view = render(<AiKeyProvider><AiProviderCard /></AiKeyProvider>)
    const input = screen.getByLabelText('Groq API Key')
    expect(input).toHaveAttribute('type', 'password')
    await user.type(input, 'personal-session-key')
    await user.click(screen.getByRole('button', { name: 'Use for this session' }))
    expect(screen.getByText('Personal Groq key active for this session')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(screen.queryByText('personal-session-key')).not.toBeInTheDocument()
    expect(window.localStorage?.length ?? 0).toBe(0)
    expect(window.sessionStorage?.length ?? 0).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Clear Key' }))
    expect(screen.getByText('No personal Groq key configured')).toBeInTheDocument()
    view.unmount()
    render(<AiKeyProvider><KeyHarness /></AiKeyProvider>)
    expect(screen.getByText('inactive')).toBeInTheDocument()
  })

  it('clears the in-memory key through the logout clearing operation', async () => {
    const user = userEvent.setup()
    render(<AiKeyProvider><><AiProviderCard /><KeyHarness /></></AiKeyProvider>)
    const input = screen.getByLabelText('Groq API Key')
    await user.type(input, 'personal-session-key')
    await user.click(screen.getByRole('button', { name: 'Use for this session' }))
    expect(screen.getByText('active')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'logout' }))
    expect(screen.getByText('inactive')).toBeInTheDocument()
  })

  it('sends the key only to analyze and never to unrelated item requests', async () => {
    setAccessToken('test-access')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await analyzeNote('1', 2, 'personal-session-key')
    await listItems('type=TASK')
    await confirmAnalysis('1', 2, [])
    const analyzeOptions = fetchMock.mock.calls[0][1]
    const unrelatedOptions = fetchMock.mock.calls[1][1]
    const confirmOptions = fetchMock.mock.calls[2][1]
    expect(analyzeOptions.headers['X-Groq-Api-Key']).toBe('personal-session-key')
    expect(unrelatedOptions.headers['X-Groq-Api-Key']).toBeUndefined()
    expect(confirmOptions.headers['X-Groq-Api-Key']).toBeUndefined()
  })
})
