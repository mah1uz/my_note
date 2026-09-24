import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { analyzeNote } from '../api/itemsApi'
import { useAiKey } from '../context/AiKeyContext'
import TabItemRow from '../features/notes/TabItemRow'
import useBodyScrollLock from './useBodyScrollLock'

/**
 * Tap-a-card popup: shows the full note text that the grid card clamps.
 * Full organization still lives on the detail page ("Open full note").
 * When opened from a category tab with several items, it also lists each
 * element with its own tick for manual ticking.
 */
export default function NotePeekModal({ note, onClose, onDelete, items = [], onItemsChanged = () => {}, onTicked = () => {}, linkedMap }) {
  const navigate = useNavigate()
  const { groqApiKey, trialActive } = useAiKey()
  const [deleting, setDeleting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const headingRef = useRef(null)
  useBodyScrollLock(note != null)

  useEffect(() => {
    headingRef.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!note) return null

  const remove = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await onDelete(note.id)
      onClose()
    } catch {
      setDeleting(false)
    }
  }
  const analyze = async () => {
    if (analyzing) return
    setAnalyzing(true)
    try {
      await analyzeNote(note.id, note.revision, groqApiKey, trialActive)
    } catch {
      // The detail page reloads the saved review and shows the error.
    } finally {
      setAnalyzing(false)
    }
    navigate(`/app/notes/${note.id}`)
  }
  const stamped = new Date(note.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

  return <div className="modal-backdrop note-peek-backdrop" onClick={onClose}>
    <div className="modal-card note-peek" role="dialog" aria-modal="true" aria-labelledby="note-peek-title" onClick={(event) => event.stopPropagation()}>
      <span className="glow-card__border" aria-hidden="true" />
      <p className="eyebrow">Note · {Number.isNaN(new Date(note.createdAt).getTime()) ? '' : stamped}</p>
      <h2 id="note-peek-title" ref={headingRef} tabIndex={-1}>{note.originalText || 'Untitled note'}</h2>
      <p className="field-help">Status: {note.processingStatus}</p>
      {items.length > 0 && <>
        <hr className="glow-line" />
        <p className="eyebrow">Tick items in this note</p>
        <ul className="tab-item-list modal-item-list" aria-label="Items in this note">
          {items.map((item) => <TabItemRow key={`${item.id}-${item.revision}`} item={item} onChanged={onItemsChanged} onTicked={onTicked} linkedMap={linkedMap} />)}
        </ul>
      </>}
      <div className="modal-actions note-peek-actions">
        <Link className="button button-primary" to={`/app/notes/${note.id}`}>Open full note</Link>
        <button className="button button-ghost" onClick={analyze} disabled={analyzing || deleting} aria-label={`Analyze ${note.originalText}`}>{analyzing ? 'Analyzing…' : 'Analyze'}</button>
        <button className="button button-danger" onClick={remove} disabled={deleting || analyzing}>{deleting ? 'Deleting…' : 'Delete'}</button>
        <button className="button button-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>
}
