import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import TransactionsPage from './TransactionsPage'
import { setAccessToken } from '../../api/http'
import { installSupabaseMock } from '../../test/supabaseMock'
import { AuthProvider } from '../../context/AuthContext'

const profile = { id: '11111111-1111-4111-8111-111111111111', username: 'maya@example.com', email: 'maya@example.com', name: 'Maya' }
let ledger
let listCalls

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  }))
}

function installMock() {
  listCalls = 0
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = new URL(input)
    const path = url.pathname
    if (path.endsWith('/auth/me/')) return jsonResponse(profile)
    if (path.endsWith('/transactions/summary/')) return jsonResponse({ currencies: [] })
    if (path.endsWith('/transactions/')) {
      listCalls += 1
      return jsonResponse([...ledger])
    }
    return jsonResponse({})
  }))
}

describe('ledger activity', () => {
  beforeEach(() => {
    setAccessToken(null)
    ledger = []
    installSupabaseMock({ authenticated: true, profile })
    installMock()
  })

  it('reloads without a spinner flash when the ledger changes elsewhere', async () => {
    window.history.pushState({}, '', '/app/transactions')
    render(<MemoryRouter><AuthProvider><TransactionsPage /></AuthProvider></MemoryRouter>)
    expect(await screen.findByText(/no matching entries/i)).toBeInTheDocument()
    expect(listCalls).toBe(1)
    // A tick on another page records an expense; the open ledger follows.
    ledger.push({
      id: 'tx-1', direction: 'DEBIT', amount: '100.00', currency: 'BDT',
      label: 'Buy shampoo', transaction_at: '2026-09-21T08:00:00Z', source_kind: 'AI_NOTE',
    })
    window.dispatchEvent(new Event('rememberly:transactions-changed'))
    expect(await screen.findByText('Buy shampoo')).toBeInTheDocument()
    await waitFor(() => expect(listCalls).toBe(2))
    // Silent background reload: no full-page loading flash over the rows.
    expect(screen.queryByText(/loading your ledger/i)).not.toBeInTheDocument()
  })
})
