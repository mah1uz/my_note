import { useState } from 'react'
import { resolveLinkedTransaction, useTaskCompletion } from '../items/ItemPages'
import { itemDate } from '../items/itemForm'

/**
 * One shared tick contract, used by tab rows, card ticks, and the peek
 * modal: ticking a priced shopping item completes it and records the
 * expense; reopening voids the row. Plain tasks and events flip status.
 *
 * On failure the list is refreshed so the next attempt uses a fresh
 * revision (stale-revision 409s self-heal); unexpected exceptions surface
 * through onUnexpected instead of vanishing silently.
 */
export async function toggleItemWithSymmetry(completion, item, { onChanged, onUnexpected } = {}) {
  try {
    if (completion.busy) return false
    const done = item.status === 'COMPLETED'
    const shopping = (item.domains || []).includes('shopping')
    let ok = false
    if (!done) {
      // Adopt any orphan row (e.g. recorded before a refresh) instead of
      // POSTing a duplicate against the one-transaction-per-item rule.
      const linked = completion.recordedId || await resolveLinkedTransaction(item)
      const ok = await completion.save({ status: 'COMPLETED' })
      if (ok && shopping && completion.recordable && !linked) await completion.record()
      return ok
    } else {
      const linked = completion.recordedId || await resolveLinkedTransaction(item)
      const ok = await completion.save({ status: 'PENDING' })
      if (ok && linked) await completion.voidRecorded(linked)
      return ok
    }
    if (!ok && onChanged) {
      try { await onChanged() } catch { /* Refresh is best-effort; the API error below still shows. */ }
    }
    return ok
  } catch (error) {
    if (onUnexpected) onUnexpected(error)
    return false
  }
}

/** Single tick for a card holding exactly one actionable item. */
export function SingleTick({ item, onChanged }) {
  const completion = useTaskCompletion(item, onChanged)
  const [unexpected, setUnexpected] = useState('')
  const done = item.status === 'COMPLETED'
  return <>
    <button
      type="button"
      className="check-button card-tick"
      disabled={completion.busy}
      aria-label={`Mark ${item.title} ${done ? 'incomplete' : 'complete'}`}
      onClick={() => toggleItemWithSymmetry(completion, item, {
        onChanged,
        onUnexpected: () => setUnexpected('The tick could not be saved. Try again.'),
      })}
    >{done ? '✓' : ''}</button>
    {unexpected && <span className="form-error" role="alert">{unexpected}</span>}
  </>
}

export default function TabItemRow({ item, onChanged }) {
  const completion = useTaskCompletion(item, onChanged)
  const [unexpected, setUnexpected] = useState('')
  const done = item.status === 'COMPLETED'
  const shopping = (item.domains || []).includes('shopping')
  return <li className={`tab-item-row${done ? ' completed' : ''}`}>
    <button type="button" className="check-button" disabled={completion.busy} aria-label={`Mark ${item.title} ${done ? 'incomplete' : 'complete'}`} onClick={() => toggleItemWithSymmetry(completion, item, {
      onChanged,
      onUnexpected: () => setUnexpected('The tick could not be saved. Try again.'),
    })}>{done ? '✓' : ''}</button>
    <span className="tab-item-main"><strong>{item.title}</strong><small>{item.item_type === 'EVENT' ? itemDate(item) : itemDate(item, 'due')}</small></span>
    {shopping && item.amount != null && <span className="shopping-price">{item.currency || ''} {item.amount}</span>}
    {completion.recordMsg && <span className="record-message" role="status">{completion.recordMsg}</span>}
    {completion.error && <span className="form-error" role="alert">{completion.error}</span>}
    {unexpected && <span className="form-error" role="alert">{unexpected}</span>}
  </li>
}
