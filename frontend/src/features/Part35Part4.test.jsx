import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import OnboardingPage from './onboarding/OnboardingPage'
import TransactionsPage from './transactions/TransactionsPage'
import SearchPage from './search/SearchPage'
import { setAccessToken } from '../api/http'

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function renderPage(page) {
  return render(<MemoryRouter>{page}</MemoryRouter>)
}

describe('Part 3.5 and Part 4 product flows', () => {
  beforeEach(() => {
    setAccessToken('test-token')
    vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
      const url = new URL(input)
      const body = options.body ? JSON.parse(options.body) : {}
      if (url.pathname.endsWith('/auth/settings/')) return jsonResponse({ user: {}, preferences: { profession: '', priority_profile: 'BALANCED' } })
      if (url.pathname.endsWith('/auth/onboarding/complete/')) return jsonResponse({ preferences: { ...body, onboarding_completed_at: '2026-09-22T00:00:00Z' } })
      if (url.pathname.endsWith('/transactions/summary/')) return jsonResponse({ currencies: [{ currency: 'BDT', credits: '5000.0000', debits: '250.0000', balance: '4750.0000' }] })
      if (url.pathname.endsWith('/transactions/linked/')) return jsonResponse({})
      if (url.pathname.endsWith('/transactions/') && !url.pathname.includes('/summary')) return jsonResponse([{ id: 'tx-1', direction: 'DEBIT', amount: '250.00', currency: 'BDT', label: 'Books', transaction_at: '2026-09-22T04:00:00Z', source_kind: 'MANUAL' }])
      if (url.pathname.endsWith('/search/')) return jsonResponse({ results: [{ kind: 'NOTE_ITEM', id: 4, title: 'University deadline', excerpt: 'Submit project', source_note_id: 1, metadata: { item_type: 'TASK', status: 'PENDING' } }] })
      if (url.pathname.endsWith('/search/answer/')) return jsonResponse({ mode: 'deterministic', answer: 'You spent 250.0000 BDT.', sources: ['tx-1'], results: [] })
      return jsonResponse({})
    }))
  })

  it('completes onboarding without local persistence', async () => {
    const user = userEvent.setup()
    renderPage(<OnboardingPage />)
    await user.selectOptions(await screen.findByLabelText('Profession'), 'EMPLOYED')
    await user.click(screen.getByRole('button', { name: /study first/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/auth/onboarding/complete/'))).toBe(true))
    expect(fetch.mock.calls.at(-1)[0]).toContain('/auth/onboarding/complete/')
  })

  it('loads ledger totals and creates a manual transaction', async () => {
    const user = userEvent.setup()
    renderPage(<TransactionsPage />)
    expect(await screen.findByText(/BDT balance/i)).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/books/i), 'Lunch')
    await user.type(screen.getByPlaceholderText('0.00'), '100')
    await user.click(screen.getByRole('button', { name: /add transaction/i }))
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith('/transactions/') && options?.method === 'POST')).toBe(true))
  })

  it('uses server search and renders result links, with a separate Ask flow', async () => {
    const user = userEvent.setup()
    renderPage(<SearchPage />)
    await user.type(screen.getByLabelText(/search your notes/i), 'university')
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    expect(await screen.findByRole('heading', { name: 'University deadline' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ask my notes/i }))
    await user.type(screen.getByLabelText(/ask a question/i), 'how much did I spend?')
    await user.click(screen.getByRole('button', { name: /^ask$/i }))
    expect(await screen.findByText(/you spent 250/i)).toBeInTheDocument()
  })
})
