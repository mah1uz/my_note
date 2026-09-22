import { apiRequest } from './http'

const normalizeNote = (note) => ({
  id: String(note.id),
  originalText: note.raw_text,
  processingStatus: note.processing_status,
  isArchived: note.is_archived,
  createdAt: note.created_at,
  updatedAt: note.updated_at,
  revision: note.revision,
  domains: [],
  itemIds: []
})

export async function listNotes() {
  return (await apiRequest('/notes/')).map(normalizeNote)
}

export async function getNote(id) {
  return normalizeNote(await apiRequest(`/notes/${id}/`))
}

export async function createNote(originalText) {
  return normalizeNote(await apiRequest('/notes/', { method: 'POST', body: JSON.stringify({ raw_text: originalText }) }))
}

export async function editNote(id, originalText) {
  return normalizeNote(await apiRequest(`/notes/${id}/`, { method: 'PATCH', body: JSON.stringify({ raw_text: originalText }) }))
}

export async function removeNote(id) {
  await apiRequest(`/notes/${id}/`, { method: 'DELETE' })
}
