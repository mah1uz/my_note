import { useEffect, useRef, useState } from 'react'
import { NOTE_MAX_LENGTH } from '../features/notes/noteTaxonomy'
import { PlusIcon } from './icons'
import { useNotes } from '../context/NotesContext'

export function AddNoteFab({ onOpen }) {
  return (
    <button
      type="button"
      className="fab"
      aria-label="Add a note"
      title="Add a note"
      onClick={onOpen}
    >
      <PlusIcon size={22} />
    </button>
  )
}

const CATEGORIES = ['General', 'Task', 'Event', 'Shopping', 'Idea']

/**
 * Compact note-entry popup. The toolbar (category, bold, heading,
 * paragraph) is presentational only: it changes the local preview and is
 * never included in the API payload, so backend categorization is untouched.
 */
export function AddNotePopup({ open, onClose }) {
  const { addNote } = useNotes()
  const [text, setText] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [bold, setBold] = useState(false)
  const [heading, setHeading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const dialogRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    previousFocus.current = document.activeElement
    setText('')
    setError('')
    setSaved(false)
    setSaving(false)
    const dialog = dialogRef.current
    dialog?.querySelector('textarea')?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
      if (event.key === 'Tab' && dialog) {
        const focusable = [...dialog.querySelectorAll('button, textarea, select, [href], input:not([disabled])')]
          .filter((element) => !element.disabled)
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (previousFocus.current && previousFocus.current.focus) previousFocus.current.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const save = async (event) => {
    event.preventDefault()
    if (!text.trim() || saving) return
    if (text.trim().length > NOTE_MAX_LENGTH) { setError(`Keep notes to ${NOTE_MAX_LENGTH} characters or fewer.`); return }
    setSaving(true)
    setError('')
    try {
      // Toolbar state is cosmetic: only the raw text is ever persisted.
      await addNote(text.trim())
      setSaved(true)
      setText('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card popup-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-note-title"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="add-note-title" className="popup-title">New note</h2>
        <div className="popup-toolbar" role="toolbar" aria-label="Formatting (display only)">
          <label className="popup-category">
            <span className="sr-only">Category (display only)</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category (display only)">
              {CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button
            type="button"
            className={`toolbar-button${bold ? ' is-active' : ''}`}
            aria-pressed={bold}
            aria-label="Bold (display only)"
            onClick={() => setBold((value) => !value)}
          >
            B
          </button>
          <button
            type="button"
            className={`toolbar-button${heading ? ' is-active' : ''}`}
            aria-pressed={heading}
            aria-label="Heading (display only)"
            onClick={() => setHeading((value) => !value)}
          >
            H
          </button>
          <span className="toolbar-hint" aria-hidden="true">¶</span>
        </div>
        <form onSubmit={save}>
          <label className="sr-only" htmlFor="popup-note-text">Note text</label>
          <textarea
            id="popup-note-text"
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What do you want to remember?"
            maxLength={NOTE_MAX_LENGTH}
            aria-describedby="popup-note-count"
            className={`popup-textarea${bold ? ' is-bold' : ''}${heading ? ' is-heading' : ''}`}
          />
          <p id="popup-note-count" className="char-count">{text.length}/{NOTE_MAX_LENGTH}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {saved && <p className="form-success" role="status">Note saved.</p>}
          <div className="modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={saving || !text.trim()}>
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
