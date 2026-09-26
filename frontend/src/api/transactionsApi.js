import { apiRequest } from './http'

export function notifyTransactionsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rememberly:transactions-changed'))
}

export function listTransactions(params = {}, signal) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value))
  return apiRequest(`/transactions/${query.toString() ? `?${query}` : ''}`, { signal })
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
