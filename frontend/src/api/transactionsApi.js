import { apiRequest } from './http'

export function listTransactions(params = {}, signal) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value))
  return apiRequest(`/transactions/${query.toString() ? `?${query}` : ''}`, { signal })
}

export function getTransactionSummary(params = {}, signal) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value))
  return apiRequest(`/transactions/summary/${query.toString() ? `?${query}` : ''}`, { signal })
}

export function createTransaction(payload) {
  return apiRequest('/transactions/', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateTransaction(id, payload) {
  return apiRequest(`/transactions/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteTransaction(id) {
  return apiRequest(`/transactions/${id}/`, { method: 'DELETE' })
}
