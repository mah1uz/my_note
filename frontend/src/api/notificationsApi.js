import { apiRequest } from './http'

export function listNotifications(signal) {
  return apiRequest('/notifications/', { signal })
}

export function markNotificationRead(id) {
  return apiRequest(`/notifications/${id}/read/`, { method: 'POST', body: '{}' })
}

export function markAllNotificationsRead() {
  return apiRequest('/notifications/read-all/', { method: 'POST', body: '{}' })
}
