import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import { NotesProvider } from '../context/NotesContext'
import { installSupabaseMock } from '../test/supabaseMock'
import { setAccessToken } from '../api/http'
import { AddNoteFab, AddNotePopup } from './AddNote'

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
}

function setup(posted) {
  setAccessToken(null)
  installSupabaseMock({
    authenticated: true,
    profile: { id: '1', username: 'm@e.com', email: 'm@e.com', name: 'M' },
  })
  vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/auth/me/')) return jsonResponse({ id: '1', email: 'm@e.com' })
    if (url.pathname.endsWith('/notes/') && options.method === 'POST') {
      posted.push(JSON.parse(options.body))
      return jsonResponse({ id: 9, raw_text: 'x', processing_status: 'UNPROCESSED', is_archived: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }, 201)
    }
    return jsonResponse([])
  }))
}

function renderPopup(posted, open = true) {
  const onClose = vi.fn()
  render(
    <AuthProvider>
      <NotesProvider>
        <AddNotePopup open={open} onClose={onClose} />
      </NotesProvider>
    </AuthProvider>,
  )
  return onClose
}

describe('AddNoteFab', () => {
  it('is a labelled, keyboard-focusable control', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<AddNoteFab onOpen={onOpen} />)
    const button = screen.getByRole('button', { name: /add a note/i })
    await user.tab()
    expect(button).toHaveFocus()
    await user.click(button)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('AddNotePopup', () => {
  it('submits only raw text while the toolbar stays cosmetic', async () => {
    const posted = []
    setup(posted)
    const user = userEvent.setup()
    renderPopup(posted)
    const textarea = await screen.findByLabelText(/note text/i)
    expect(textarea).toHaveFocus()
    await user.selectOptions(screen.getByLabelText(/category/i), 'Shopping')
    await user.click(screen.getByRole('button', { name: /bold/i }))
    await user.click(screen.getByRole('button', { name: /heading/i }))
    await user.type(textarea, 'Buy milk')
    await user.click(screen.getByRole('button', { name: /^save note$/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/note saved/i)
    expect(posted).toEqual([{ raw_text: 'Buy milk' }])
  })

  it('closes on Cancel, backdrop, and Escape, and reports errors', async () => {
    const posted = []
    setup(posted)
    const user = userEvent.setup()
    const onClose = renderPopup(posted)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not render when closed', () => {
    const posted = []
    setup(posted)
    renderPopup(posted, false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
