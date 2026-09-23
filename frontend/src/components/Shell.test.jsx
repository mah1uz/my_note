import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { installSupabaseMock } from '../test/supabaseMock'
import { setAccessToken } from '../api/http'
import Notifications from './Notifications'
import { UnlockProCard, UnlockProModal } from './UnlockPro'

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function renderWithAuth(children) {
  return render(
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>,
  )
}

describe('Unlock Pro', () => {
  it('submits a real request and shows the server-issued code', async () => {
    const user = userEvent.setup()
    setAccessToken('test-access')
    installSupabaseMock({
      authenticated: true,
      profile: { id: '1', username: 'm@e.com', email: 'm@e.com', name: 'M' },
    })
    const posted = []
    vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
      const url = new URL(input)
      if (url.pathname.endsWith('/auth/me/')) return jsonResponse({ id: '1', email: 'm@e.com' })
      if (url.pathname.endsWith('/auth/pro/request/')) {
        if ((options.method || 'GET') === 'POST') {
          posted.push(JSON.parse(options.body))
          return jsonResponse({ code: 'ABCD2345', status: 'PENDING', reason: '', created_at: null, decided_at: null }, 201)
        }
        return jsonResponse({ detail: 'No Pro access request yet.' }, 404)
      }
      return jsonResponse({})
    }))
    const { rerender } = renderWithAuth(<UnlockProCard onOpen={() => {}} />)
    expect(screen.getByRole('button', { name: /unlock pro/i })).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <AuthProvider>
          <UnlockProModal open onClose={() => {}} />
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('dialog', { name: /unlock pro/i })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('m@e.com')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/what do you want pro for/i), 'More trials')
    await user.click(screen.getByRole('button', { name: /^request pro$/i }))
    expect(await screen.findByRole('status')).toHaveTextContent('ABCD2345')
    expect(posted).toEqual([{ reason: 'More trials' }])
  })

  it('shows an existing pending request instead of a second form submit', async () => {
    const user = userEvent.setup()
    setAccessToken('test-access')
    installSupabaseMock({
      authenticated: true,
      profile: { id: '1', username: 'm@e.com', email: 'm@e.com', name: 'M' },
    })
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = new URL(input)
      if (url.pathname.endsWith('/auth/me/')) return jsonResponse({ id: '1', email: 'm@e.com' })
      if (url.pathname.endsWith('/auth/pro/request/')) {
        return jsonResponse({ code: 'OPEN1234', status: 'PENDING', reason: '', created_at: null, decided_at: null })
      }
      return jsonResponse({})
    }))
    renderWithAuth(<UnlockProModal open onClose={() => {}} />)
    expect(await screen.findByText(/already have an open request/i)).toHaveTextContent('OPEN1234')
    void user
  })

  it('closes on Escape and Cancel', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    setAccessToken(null)
    installSupabaseMock({ authenticated: false, profile: {} })
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})))
    renderWithAuth(<UnlockProModal open onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('Notifications', () => {
  const items = [
    { id: 'a', type: 'TASK_DUE_SOON', title: 'Task due soon', message: 'EM Quiz tomorrow', read: false, read_at: null, created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 'b', type: 'TASK_COMPLETED', title: 'Task completed', message: 'Buy eggs done', read: true, read_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date(Date.now() - 86400000).toISOString() },
  ]

  it('shows an empty state when there is nothing to show', async () => {
    const user = userEvent.setup()
    render(<Notifications items={[]} onMarkRead={() => {}} onMarkAllRead={() => {}} />)
    await user.click(screen.getByRole('button', { name: /^notifications$/i }))
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument()
  })

  it('badges unread items and delegates read actions to the server', async () => {
    const user = userEvent.setup()
    const onMarkRead = vi.fn()
    const onMarkAllRead = vi.fn()
    render(<Notifications items={items} onMarkRead={onMarkRead} onMarkAllRead={onMarkAllRead} />)
    expect(screen.getByRole('button', { name: /1 unread/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /1 unread/i }))
    expect(screen.getByText(/em quiz tomorrow/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /mark task due soon as read/i }))
    expect(onMarkRead).toHaveBeenCalledWith('a')
    await user.click(screen.getByRole('button', { name: /mark all as read/i }))
    expect(onMarkAllRead).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Notifications items={items} onMarkRead={() => {}} onMarkAllRead={() => {}} />)
    await user.click(screen.getByRole('button', { name: /unread/i }))
    expect(screen.getByRole('dialog', { name: /notifications/i })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
