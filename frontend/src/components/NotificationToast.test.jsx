import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NotificationToast from './NotificationToast'

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function renderToast(items, prefs = { notification_enabled: true }) {
  const calls = []
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    calls.push(String(input))
    const url = new URL(input)
    if (url.pathname.endsWith('/auth/preferences/')) return jsonResponse(prefs)
    return jsonResponse({})
  }))
  const view = render(<NotificationToast items={items} />)
  return { ...view, calls }
}

const row = (id, read = false) => ({
  id, type: 'TASK_DUE_SOON', title: `Task ${id}`, message: 'Due soon',
  read, read_at: null, created_at: new Date().toISOString(),
})

describe('NotificationToast', () => {
  it('stays silent for pre-existing rows and pops only new arrivals', async () => {
    const { rerender, calls } = renderToast([row('a')])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await waitFor(() => expect(calls.some((url) => url.includes('/auth/preferences/'))).toBe(true))
    rerender(<NotificationToast items={[row('a'), row('b')]} />)
    expect(await screen.findByText('Task b')).toBeInTheDocument()
    expect(screen.queryByText('Task a')).not.toBeInTheDocument()
  })

  it('never pops when the master switch is off', async () => {
    const { rerender } = renderToast([], { notification_enabled: false })
    rerender(<NotificationToast items={[row('a'), row('b')]} />)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('never pops for already-read arrivals', async () => {
    const { rerender } = renderToast([])
    rerender(<NotificationToast items={[row('a', true)]} />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('dismisses on user action', async () => {
    const user = userEvent.setup()
    const { rerender, calls } = renderToast([])
    await waitFor(() => expect(calls.some((url) => url.includes('/auth/preferences/'))).toBe(true))
    rerender(<NotificationToast items={[row('a')]} />)
    await user.click(await screen.findByRole('button', { name: /dismiss task a/i }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
