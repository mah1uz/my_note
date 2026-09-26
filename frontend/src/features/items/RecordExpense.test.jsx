import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ShoppingPage, TasksPage } from './ItemPages'
import { setAccessToken } from '../../api/http'
import { installSupabaseMock } from '../../test/supabaseMock'
import { AuthProvider } from '../../context/AuthContext'

const profile = { id: '11111111-1111-4111-8111-111111111111', username: 'maya@example.com', email: 'maya@example.com', name: 'Maya' }
let taskState
let recorded
let calls
let failNextPost
let delayPatchMs
let holdPatch
let releasePatch

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
      if (delayPatchMs) await new Promise((resolve) => setTimeout(resolve, delayPatchMs))
      if (holdPatch) await new Promise((resolve) => { releasePatch = resolve })
      calls[calls.length - 1].body = JSON.parse(options.body)
      Object.assign(taskState, JSON.parse(options.body), { revision: taskState.revision + 1 })
      return jsonResponse({ ...taskState })
    }
    if (path.endsWith('/transactions/') && method === 'GET') {
      if (url.searchParams.get('note_item') === '7') return jsonResponse([...recorded])
      return jsonResponse([])
    }
    if (path.endsWith('/transactions/') && method === 'POST') {
      calls[calls.length - 1].body = JSON.parse(options.body)
      if (failNextPost) {
        failNextPost = false
        return jsonResponse({ detail: 'This transaction conflicts with an existing ledger record.' }, 400)
      }
      const created = { id: 'tx-1', ...JSON.parse(options.body) }
      recorded.push(created)
      return jsonResponse(created, 201)
    }
    if (path.includes('/transactions/') && method === 'DELETE') {
      recorded = recorded.filter((row) => !path.includes(row.id))
      return jsonResponse(null, 204)
    }
    if (path.includes('/transactions/') && method === 'PATCH') {
      const body = JSON.parse(options.body)
      recorded = recorded.map((row) => (path.includes(row.id) ? { ...row, ...body } : row))
      calls[calls.length - 1].body = body
      return jsonResponse(recorded.find((row) => path.includes(row.id)) || {})
    }
    return jsonResponse({})
  }))
}

function renderTasks() {
  window.history.pushState({}, '', '/app/tasks')
  return render(<MemoryRouter><AuthProvider><TasksPage /></AuthProvider></MemoryRouter>)
}

function renderShopping() {
  window.history.pushState({}, '', '/app/shopping')
  return render(<MemoryRouter><AuthProvider><ShoppingPage /></AuthProvider></MemoryRouter>)
}

describe('tick-done expense recording', () => {
  beforeEach(() => {
    setAccessToken(null)
    taskState = baseTask()
    recorded = []
    failNextPost = false
    delayPatchMs = 0
    holdPatch = false
    releasePatch = null
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

  it('flips the checkbox instantly while the PATCH is still in flight', async () => {
    taskState = { ...baseTask(), amount: null, currency: null, status: 'PENDING' }
    holdPatch = true
    const user = userEvent.setup()
    renderTasks()
    // Settle the session first so the clicked node is never a detached render.
    await waitFor(() => expect(screen.queryByText('Buy shampoo')).toBeInTheDocument())
    const button = await screen.findByRole('button', { name: /mark buy shampoo complete/i })
    const clicked = user.click(button)
    // The PATCH is held open: only the optimistic flip can show this.
    await waitFor(() => expect(screen.getByRole('button', { name: /mark buy shampoo incomplete/i })).toBeInTheDocument())
    expect(taskState.status).toBe('PENDING')
    releasePatch()
    await clicked
    await waitFor(() => expect(taskState.status).toBe('COMPLETED'))
    expect(await screen.findByRole('button', { name: /mark buy shampoo incomplete/i })).toBeInTheDocument()
  })

  it('adopts the existing ledger row when the record POST conflicts', async () => {
    taskState = { ...baseTask(), status: 'PENDING' }
    recorded = [{ id: 'tx-orphan' }]
    failNextPost = true
    const user = userEvent.setup()
    renderShopping()
    // Settle the session first so the clicked node is never a detached render.
    await waitFor(() => expect(screen.queryByText('Buy shampoo')).toBeInTheDocument())
    await user.click(await screen.findByRole('button', { name: /mark buy shampoo complete/i }))
    // Shopping rows auto-record on tick and show the compact pill.
    expect(await screen.findByText('Recorded', { selector: 'span.pill' })).toBeInTheDocument()
    const txCalls = calls.filter((call) => call.path.startsWith('/api/v1/transactions/'))
    expect(txCalls[0].method).toBe('POST')
    expect(txCalls.filter((call) => call.method === 'POST')).toHaveLength(1)
  })

  it('edits the extracted price and syncs the linked ledger row', async () => {
    taskState = { ...baseTask(), status: 'PENDING' }
    const user = userEvent.setup()
    renderShopping()
    await waitFor(() => expect(screen.queryByText('Buy shampoo')).toBeInTheDocument())
    await user.click(await screen.findByRole('button', { name: /mark buy shampoo complete/i }))
    expect(await screen.findByText('Recorded', { selector: 'span.pill' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /set price for buy shampoo/i }))
    expect(screen.getByText('Current price: BDT 100.00')).toBeInTheDocument()
    const amountInput = screen.getByLabelText('Price amount')
    expect(amountInput).toHaveValue(100)
    await user.clear(amountInput)
    await user.type(amountInput, '150')
    await user.click(screen.getByRole('button', { name: /save price/i }))
    // A successful save bumps the revision, remounting the row with the new
    // price inline — that is the visible confirmation.
    expect(await screen.findByText('BDT 150')).toBeInTheDocument()
    const itemPatches = calls.filter((call) => call.path === '/api/v1/items/7/' && call.method === 'PATCH')
    expect(itemPatches[itemPatches.length - 1].body).toMatchObject({ amount: '150' })
    const txPatch = calls.find((call) => call.path.includes('/transactions/tx-1/') && call.method === 'PATCH')
    expect(txPatch.body).toMatchObject({ amount: '150', currency: 'BDT' })
    expect(recorded[0]).toMatchObject({ amount: '150', currency: 'BDT' })
  })

  it('adds a price to an item that has none', async () => {
    taskState = { ...baseTask(), status: 'PENDING', amount: null, currency: null }
    const user = userEvent.setup()
    renderShopping()
    await waitFor(() => expect(screen.queryByText('Buy shampoo')).toBeInTheDocument())
    await user.click(await screen.findByRole('button', { name: /set price for buy shampoo/i }))
    expect(screen.getByText(/no price set yet/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Price amount'), '75')
    await user.type(screen.getByLabelText('Price currency'), 'BDT')
    await user.click(screen.getByRole('button', { name: /save price/i }))
    expect(await screen.findByText('BDT 75')).toBeInTheDocument()
    expect(taskState.amount).toBe('75')
    expect(taskState.currency).toBe('BDT')
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
