import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TasksPage } from './ItemPages'
import { setAccessToken } from '../../api/http'
import { installSupabaseMock } from '../../test/supabaseMock'
import { AuthProvider } from '../../context/AuthContext'

const profile = { id: '11111111-1111-4111-8111-111111111111', username: 'maya@example.com', email: 'maya@example.com', name: 'Maya' }
let taskState
let recorded
let calls

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(status === 204 ? null : JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  }))
}

function baseTask() {
  return {
    id: 7, revision: 0, item_type: 'TASK', title: 'Buy shampoo', summary: '',
    normalized_text: '', domains: ['shopping'], importance: 'NORMAL', status: 'COMPLETED',
    amount: '100.00', currency: 'BDT', quantity: null, unit: null, place_hint: null,
    note: 3, start_date: null, due_date: null, start_datetime: null, due_datetime: null,
    confidence: null, is_confirmed: true,
    created_at: '2026-09-21T08:00:00Z', updated_at: '2026-09-21T08:00:00Z',
  }
}

function installMock() {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
    const url = new URL(input)
    const path = url.pathname
    const method = options.method || 'GET'
    calls.push({ path: path + url.search, method })
    if (path.endsWith('/auth/me/')) return jsonResponse(profile)
    if (path.endsWith('/items/')) return jsonResponse([{ ...taskState }])
    const itemMatch = path.match(/\/items\/(\d+)\/$/)
    if (itemMatch && method === 'PATCH') {
      Object.assign(taskState, JSON.parse(options.body), { revision: taskState.revision + 1 })
      return jsonResponse({ ...taskState })
    }
    if (path.endsWith('/transactions/') && method === 'GET') {
      if (url.searchParams.get('note_item') === '7') return jsonResponse([...recorded])
      return jsonResponse([])
    }
    if (path.endsWith('/transactions/') && method === 'POST') {
      const created = { id: 'tx-1', ...JSON.parse(options.body) }
      recorded.push(created)
      calls[calls.length - 1].body = JSON.parse(options.body)
      return jsonResponse(created, 201)
    }
    if (path.includes('/transactions/') && method === 'DELETE') {
      recorded = recorded.filter((row) => !path.includes(row.id))
      return jsonResponse(null, 204)
    }
    return jsonResponse({})
  }))
}

function renderTasks() {
  window.history.pushState({}, '', '/app/tasks')
  return render(<MemoryRouter><AuthProvider><TasksPage /></AuthProvider></MemoryRouter>)
}

describe('tick-done expense recording', () => {
  beforeEach(() => {
    setAccessToken(null)
    taskState = baseTask()
    recorded = []
    installSupabaseMock({ authenticated: true, profile })
    installMock()
  })

  it('records a completed shopping task as a linked expense', async () => {
    const user = userEvent.setup()
    renderTasks()
    await user.click(await screen.findByRole('button', { name: /record as expense/i }))
    await waitFor(() => expect(calls.some((call) => call.path === '/api/v1/transactions/' && call.method === 'POST')).toBe(true))
    const post = calls.find((call) => call.path === '/api/v1/transactions/' && call.method === 'POST')
    expect(post.body).toMatchObject({
      note_item: 7, direction: 'DEBIT', amount: '100.00', currency: 'BDT',
      label: 'Buy shampoo', primary_domain: 'shopping',
    })
    expect(post.body.transaction_at).toBeTruthy()
    expect(screen.getByText('Recorded as expense', { selector: 'span.pill' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/recorded as expense/i)
  })

  it('reopening a recorded task voids the linked expense', async () => {
    recorded = [{ id: 'tx-9' }]
    const user = userEvent.setup()
    renderTasks()
    expect(await screen.findByText(/recorded as expense/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /mark buy shampoo incomplete/i }))
    await waitFor(() => expect(calls.some((call) => call.path.includes('/transactions/tx-9/') && call.method === 'DELETE')).toBe(true))
    expect(await screen.findByRole('button', { name: /mark buy shampoo complete/i })).toBeInTheDocument()
  })

  it('shows no record action for tasks without a price', async () => {
    taskState = { ...baseTask(), amount: null, currency: null, status: 'COMPLETED' }
    renderTasks()
    // Let the session settle: the pre-login render unmounts once restore
    // completes, which can detach nodes a bare findByRole just discovered.
    await waitFor(() => expect(screen.queryByText('Buy shampoo')).toBeInTheDocument())
    expect(await screen.findByRole('heading', { name: 'Buy shampoo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /record as expense/i })).not.toBeInTheDocument()
  })
})
