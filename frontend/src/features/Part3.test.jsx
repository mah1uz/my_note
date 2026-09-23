import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { setAccessToken } from '../api/http'
import { installSupabaseMock } from '../test/supabaseMock'
import { AppStateProvider } from '../context/AppStateContext'
import { AuthProvider } from '../context/AuthContext'
import { NotesProvider } from '../context/NotesContext'
import { exampleItem, installPart3Mock } from '../test/part3ApiMock'

function renderApp(path = '/app/notes/1') {
  window.history.pushState({}, '', path)
  return render(<AuthProvider><NotesProvider><AppStateProvider><App /></AppStateProvider></NotesProvider></AuthProvider>)
}

describe('Part 3 review and confirmed-item integration', () => {
  let api
  beforeEach(() => {
    setAccessToken(null)
    installSupabaseMock({
      authenticated: true,
      profile: { id: '11111111-1111-4111-8111-111111111111', username: 'maya@example.com', email: 'maya@example.com', name: 'Maya' },
    })
    api = installPart3Mock()
  })

  it('loads the saved note independently of AI and displays analysis loading', async () => {
    let resolve
    api.analyzeWait = new Promise((done) => { resolve = done })
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByText(api.note.raw_text)).toBeInTheDocument()
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/analyze/'))).toBe(false)
    await user.click(await screen.findByRole('button', { name: 'Analyze note' }))
    expect(screen.getByRole('button', { name: 'Analyzing…' })).toBeDisabled()
    expect(screen.getByText(api.note.raw_text)).toBeInTheDocument()
    await act(async () => resolve())
    expect(await screen.findByLabelText('Title')).toHaveValue('Buy eggs')
    expect(screen.getByText(/94% · Review before confirming/)).toBeInTheDocument()
  })

  it('reviews multiple items, corrects fields, removes and manually adds before confirming', async () => {
    api.analysisItems = [exampleItem(), exampleItem({ id: 2, item_type: 'EVENT', title: 'Class', domains: ['education'], confidence: 0.75 }), exampleItem({ id: 3, item_type: 'EXPENSE', title: 'Books', amount: '250.00', currency: 'BDT', confidence: 0.4 })]
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Analyze note' }))
    expect(await screen.findAllByLabelText('Title')).toHaveLength(3)
    expect(screen.getByText(/Needs careful review/)).toBeInTheDocument()
    expect(screen.getByText(/Uncertain — check carefully/)).toBeInTheDocument()
    const first = screen.getAllByLabelText('Title')[0]
    await user.clear(first)
    await user.type(first, 'Buy six eggs')
    await user.click(screen.getByRole('button', { name: 'Remove item 2' }))
    await user.click(screen.getByRole('button', { name: 'Add missing item' }))
    await user.type(screen.getAllByLabelText('Title')[2], 'Ask supervisor')
    await user.selectOptions(screen.getAllByLabelText('Type')[2], 'INFORMATION')
    const manual = within(screen.getAllByRole('group', { name: /^Item / })[2])
    await user.click(manual.getByLabelText('work'))
    await user.click(screen.getByRole('button', { name: 'Confirm all' }))
    expect(await screen.findByText('Organization confirmed and saved.')).toBeInTheDocument()
    expect(api.confirmedPayload.items.map((item) => item.title)).toEqual(['Buy six eggs', 'Books', 'Ask supervisor'])
    expect(api.confirmedPayload.items[2].domains).toContain('work')
    expect(api.confirmedPayload.items[0]).not.toHaveProperty('confidence')
    expect(api.confirmedPayload.items[0]).not.toHaveProperty('is_confirmed')
    expect(screen.getByText(api.note.raw_text)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Confirmed items' })).toBeInTheDocument()
  })

  it('preserves raw notes on provider failure and supports retry', async () => {
    api.failAnalyze = true
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Analyze note' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your note is saved')
    expect(screen.getByText(api.note.raw_text)).toBeInTheDocument()
    api.failAnalyze = false
    await user.click(await screen.findByRole('button', { name: 'Retry AI Analysis' }))
    expect(await screen.findByLabelText('Title')).toHaveValue('Buy eggs')
  })

  it('organizes manually without AI and serializes date-only and timed facts explicitly', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Organize Manually' }))
    await user.type(screen.getByLabelText('Title'), 'Chilli')
    await user.selectOptions(screen.getByLabelText('Type'), 'EXPENSE')
    await user.type(screen.getByLabelText('Amount'), '50.25')
    await user.type(screen.getByLabelText(/Currency/), 'bdt')
    await user.type(screen.getByLabelText('Quantity'), '300')
    await user.type(screen.getByLabelText('Unit'), 'gram')
    await user.type(screen.getByLabelText('Place hint'), 'Agora')
    await user.type(screen.getByLabelText('Summary / uncertainty'), 'Receipt recorded')
    await user.selectOptions(screen.getByLabelText('Importance'), 'HIGH')
    fireEvent.change(screen.getByLabelText('Start / expense date'), { target: { value: '2026-09-23' } })
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-09-24' } })
    fireEvent.change(screen.getByLabelText('Due time (optional)'), { target: { value: '10:00' } })
    await user.click(screen.getByLabelText('shopping'))
    await user.click(screen.getByLabelText('finance'))
    await user.click(screen.getByRole('button', { name: 'Confirm all' }))
    await screen.findByText('Organization confirmed and saved.')
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/analyze/'))).toBe(false)
    expect(api.confirmedPayload.items[0]).toMatchObject({ amount: '50.25', currency: 'BDT', quantity: '300', unit: 'gram', start_date: '2026-09-23', start_datetime: null, due_date: null, due_datetime: '2026-09-24T10:00:00+06:00' })
  })

  it('keeps user edits visible on server validation errors and lets them correct and resubmit', async () => {
    api.failConfirm = true
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Organize Manually' }))
    await user.type(screen.getByLabelText('Title'), 'My manual fact')
    await user.click(screen.getByRole('button', { name: 'Confirm all' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Check this title')
    expect(screen.getByLabelText('Title')).toHaveValue('My manual fact')
    api.failConfirm = false
    await user.click(screen.getByRole('button', { name: 'Confirm all' }))
    expect(await screen.findByText('Organization confirmed and saved.')).toBeInTheDocument()
  })

  it('handles zero extracted items without inventing any, including explicit empty confirmation', async () => {
    api.analysisItems = []
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Analyze note' }))
    expect(await screen.findByText(/No structured items found/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm empty review' }))
    await screen.findByText('Organization confirmed and saved.')
    expect(api.confirmedPayload.items).toEqual([])
  })

  it('handles unavailable review data and reloads rather than submitting an unknown revision', async () => {
    api.failReview = true
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('alert')).toHaveTextContent('Review unavailable')
    expect(screen.queryByRole('button', { name: 'Analyze note' })).not.toBeInTheDocument()
    api.failReview = false
    await user.click(screen.getByRole('button', { name: 'Reload saved review' }))
    expect(await screen.findByRole('button', { name: 'Analyze note' })).toBeEnabled()
  })

  it('can reload an in-flight request from another tab', async () => {
    api.analysisRunning = true
    api.note.processing_status = 'PROCESSING'
    const user = userEvent.setup()
    renderApp()
    expect(await screen.findByRole('button', { name: 'Retry AI Analysis' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Organize Manually' })).toBeDisabled()
    api.analysisRunning = false
    await user.click(screen.getByRole('button', { name: 'Reload status' }))
    expect(await screen.findByRole('button', { name: 'Retry AI Analysis' })).toBeEnabled()
  })

  it('loads confirmed Tasks, toggles both ways, and saves basic edits through the API', async () => {
    api.items = [exampleItem({ is_confirmed: true })]
    const user = userEvent.setup()
    renderApp('/app/tasks')
    await user.click(await screen.findByRole('button', { name: 'Mark Buy eggs complete' }))
    await user.click(await screen.findByRole('button', { name: 'Mark Buy eggs incomplete' }))
    expect(await screen.findByRole('button', { name: 'Mark Buy eggs complete' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit task' }))
    await user.clear(screen.getByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Buy bread')
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    expect(await screen.findByRole('heading', { name: 'Buy bread' })).toBeInTheDocument()
    expect(api.items[0].title).toBe('Buy bread')
  })

  it('reports task edit conflicts and reloads current server data', async () => {
    api.items = [exampleItem({ is_confirmed: true })]
    api.failPatch = true
    const user = userEvent.setup()
    renderApp('/app/tasks')
    await user.click(await screen.findByRole('button', { name: 'Mark Buy eggs complete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This note changed')
    api.failPatch = false
    await user.click(screen.getByRole('button', { name: 'Reload items' }))
    expect(await screen.findByRole('button', { name: 'Mark Buy eggs complete' })).toBeEnabled()
  })

  it('renders real Events and Expenses, including date-only facts and explicit currency/quantity', async () => {
    api.items = [exampleItem({ is_confirmed: true, item_type: 'EVENT', title: 'EM Quiz', start_date: '2026-09-23', domains: ['education'] }), exampleItem({ id: 2, is_confirmed: true, item_type: 'EXPENSE', title: 'Chilli', amount: '50.00', currency: 'BDT', quantity: '300.000', unit: 'gram' })]
    const eventView = renderApp('/app/events')
    expect(await screen.findByRole('heading', { name: 'EM Quiz' })).toBeInTheDocument()
    expect(screen.getByText('2026-09-23 · time not specified')).toBeInTheDocument()
    eventView.unmount()
    renderApp('/app/expenses')
    expect(await screen.findByText('BDT 50.00')).toBeInTheDocument()
    expect(screen.getByText('300.000 gram')).toBeInTheDocument()
    expect(screen.queryByText('৳4,850')).not.toBeInTheDocument()
  })

  it('shows pending and completed Shopping tasks with per-item ticks', async () => {
    api.items = [exampleItem({ is_confirmed: true }), exampleItem({ id: 2, title: 'Rice', is_confirmed: true, place_hint: null }), exampleItem({ id: 3, title: 'Already done', is_confirmed: true, status: 'COMPLETED' })]
    renderApp('/app/shopping')
    expect(await screen.findByRole('heading', { name: 'Agora' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No location' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark already done incomplete/i })).toBeInTheDocument()
    expect(screen.getByText('Already done')).toBeInTheDocument()
  })

  it('ticking a priced shopping item records it as an expense', async () => {
    api.items = [exampleItem({ is_confirmed: true, amount: '100.00', currency: 'BDT' })]
    const user = userEvent.setup()
    renderApp('/app/shopping')
    await user.click(await screen.findByRole('button', { name: /mark buy eggs complete/i }))
    expect(await screen.findByText('Recorded')).toBeInTheDocument()
    expect(api.transactions).toEqual([{ id: 'tx-1', note_item: 1, direction: 'DEBIT', amount: '100.00', currency: 'BDT', label: 'Buy eggs', transaction_at: expect.any(String), primary_domain: 'shopping' }])
  })

  it('supports empty states on all four item pages', async () => {
    for (const [path, label] of [['tasks', 'No tasks yet'], ['events', 'No upcoming events'], ['expenses', 'No expenses recorded'], ['shopping', 'No shopping items']]) {
      const view = renderApp(`/app/${path}`)
      expect(await screen.findByRole('heading', { name: label })).toBeInTheDocument()
      view.unmount()
    }
  })

  it('handles item-list API errors with retry', async () => {
    api.failList = true
    const user = userEvent.setup()
    renderApp('/app/tasks')
    expect(await screen.findByRole('alert')).toHaveTextContent('Items unavailable')
    api.failList = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument()
  })

  it('does not render a delayed analysis response after navigating away', async () => {
    let resolve
    api.analyzeWait = new Promise((done) => { resolve = done })
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Analyze note' }))
    await user.click(screen.getAllByRole('link', { name: /Tasks$/ })[0])
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument()
    await act(async () => resolve())
    await waitFor(() => expect(screen.queryByLabelText('Title')).not.toBeInTheDocument())
  })
})
