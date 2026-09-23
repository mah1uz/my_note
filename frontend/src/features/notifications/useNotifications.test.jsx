import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../context/AuthContext'
import { installSupabaseMock } from '../../test/supabaseMock'
import { setAccessToken } from '../../api/http'
import { getProRequest } from '../../api/proApi'
import { useNotifications } from './useNotifications'

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function Harness() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications()
  return (
    <div>
      <span data-testid="count">{unreadCount}</span>
      <ul>{items.map((item) => <li key={item.id}>{item.title}:{item.read ? 'read' : 'unread'}</li>)}</ul>
      <button onClick={() => markRead('n1')}>read-one</button>
      <button onClick={() => markAllRead()}>read-all</button>
    </div>
  )
}

describe('useNotifications', () => {
  it('loads server rows, marks one read, and marks all read', async () => {
    const user = userEvent.setup()
    setAccessToken('test-access')
    installSupabaseMock({
      authenticated: true,
      profile: { id: '1', username: 'm@e.com', email: 'm@e.com', name: 'M' },
    })
    let rows = [
      { id: 'n1', type: 'TASK_DUE_SOON', title: 'Due', message: '', read: false, read_at: null, created_at: new Date().toISOString() },
      { id: 'n2', type: 'SYSTEM', title: 'Hi', message: '', read: false, read_at: null, created_at: new Date().toISOString() },
    ]
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
      const url = new URL(input)
      calls.push(`${options.method || 'GET'} ${url.pathname}`)
      if (url.pathname.endsWith('/auth/me/')) return jsonResponse({ id: '1', email: 'm@e.com' })
      if (url.pathname.endsWith('/notifications/')) return jsonResponse(rows)
      const single = url.pathname.match(/\/notifications\/(.+)\/read\/$/)
      if (single) {
        rows = rows.map((row) => (row.id === single[1] ? { ...row, read: true, read_at: new Date().toISOString() } : row))
        return jsonResponse(rows.find((row) => row.id === single[1]))
      }
      if (url.pathname.endsWith('/notifications/read-all/')) {
        rows = rows.map((row) => ({ ...row, read: true, read_at: row.read_at || new Date().toISOString() }))
        return jsonResponse({ marked_read: 2 })
      }
      return jsonResponse({})
    }))
    render(<AuthProvider><Harness /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'))
    expect(calls).toContain('GET /api/v1/notifications/')
    await user.click(screen.getByRole('button', { name: 'read-one' }))
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    await user.click(screen.getByRole('button', { name: 'read-all' }))
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('0'))
  })

  it('reads the current pro request through the API module', async () => {
    setAccessToken('test-access')
    installSupabaseMock({ authenticated: false, profile: {} })
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 'QWERTY12', status: 'PENDING' })))
    const current = await getProRequest()
    expect(current.code).toBe('QWERTY12')
  })
})
