import { apiRequest, unwrapPage } from './http'

export function listTransactions(params = {}, { page = 1, signal } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value))
  if (page > 1) query.set('page', String(page))
  const suffix = query.toString()
  return apiRequest(`/transactions/${suffix ? `?${suffix}` : ''}`, { signal }).then((data) => {
    const { items, hasMore } = unwrapPage(data)
    return { transactions: items, hasMore }
  })
}

export function listLinkedTransactions(ids = [], signal) {
  const clean = [...new Set(ids.map((id) => String(id)).filter(Boolean))].slice(0, 100)
  if (!clean.length) return Promise.resolve({})
  const query = new URLSearchParams({ ids: clean.join(',') })
  return apiRequest(`/transactions/linked/?${query.toString()}`, { signal })
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
