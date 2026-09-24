import { apiRequest, unwrapPage } from './http'

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

export async function listNotes(page = 1) {
  const { items, count, hasMore } = unwrapPage(await apiRequest(`/notes/${page > 1 ? `?page=${page}` : ''}`))
  return { notes: items.map(normalizeNote), total: count, hasMore }
}

export async function getNote(id) {
  return normalizeNote(await apiRequest(`/notes/${id}/`))
}

export async function createNote(originalText) {
  return normalizeNote(await apiRequest('/notes/', { method: 'POST', body: JSON.stringify({ raw_text: originalText }) }))
}

export async function editNote(id, originalText, revision) {
  const body = { raw_text: originalText }
  if (revision !== undefined && revision !== null) body.revision = revision
  return normalizeNote(await apiRequest(`/notes/${id}/`, { method: 'PATCH', body: JSON.stringify(body) }))
}

export async function removeNote(id) {
  await apiRequest(`/notes/${id}/`, { method: 'DELETE' })
}
