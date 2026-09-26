import { apiRequest } from './http'

export function notifyTransactionsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rememberly:transactions-changed'))
}

export function listTransactions(params = {}, signal) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value))
  return apiRequest(`/transactions/${query.toString() ? `?${query}` : ''}`, { signal })
}

/**
 * Ledger row recorded for one item, or null. Never throws: callers treat
 * lookup failure as "unknown" and let the POST-or-adopt step decide.
 */
export async function findLinkedTransactionId(noteItemId) {
  try {
    const rows = await listTransactions({ note_item: noteItemId })
    return (Array.isArray(rows) && rows[0]?.id) || null
  } catch {
    return null
  }
}

export function getTransactionSummary(params = {}, signal) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value))
  return apiRequest(`/transactions/summary/${query.toString() ? `?${query}` : ''}`, { signal })
}

export async function createTransaction(payload) {
  const result = await apiRequest('/transactions/', { method: 'POST', body: JSON.stringify(payload) })
  notifyTransactionsChanged()
  return result
}

export async function updateTransaction(id, payload) {
  const result = await apiRequest(`/transactions/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
  notifyTransactionsChanged()
  return result
}

export async function deleteTransaction(id) {
  const result = await apiRequest(`/transactions/${id}/`, { method: 'DELETE' })
  notifyTransactionsChanged()
  return result
}
