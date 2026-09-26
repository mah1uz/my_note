import { useState } from 'react'
import { resolveLinkedTransaction, useTaskCompletion } from '../items/ItemPages'
import PriceMenu from '../items/PriceMenu'
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
export async function toggleItemWithSymmetry(completion, item, { onChanged, onUnexpected, onTicked } = {}) {
  try {
    if (completion.busy) return false
    const done = item.status === 'COMPLETED'
    const shopping = Boolean(completion.recordable)
    // The click is visible immediately; the server result (including the
    // shared note revision) replaces it once the PATCH succeeds.
    onTicked?.(item.id, done ? 'PENDING' : 'COMPLETED')
    let ok = false
    if (!done) {
      // No pre-save ledger lookup: a duplicate record POST is adopted via
      // the backend's unique linkage instead.
      const linked = shopping ? completion.recordedId : null
      ok = await completion.save({ status: 'COMPLETED' })
      if (ok && shopping && completion.recordable && !linked) await completion.record()
    } else {
      // The void-target lookup runs alongside the PATCH instead of before it.
      const linkedPromise = !shopping
        ? Promise.resolve(null)
        : completion.recordedId
          ? Promise.resolve(completion.recordedId)
          : resolveLinkedTransaction(item)
      ok = await completion.save({ status: 'PENDING' })
      const linked = await linkedPromise
      if (ok && linked) await completion.voidRecorded(linked)
    }
    if (ok) {
      onTicked?.(item.id, done ? 'PENDING' : 'COMPLETED', ok)
    } else if (onChanged) {
      onTicked?.(item.id, item.status)
      try { await onChanged() } catch { /* Refresh is best-effort; the API error below still shows. */ }
    } else {
      onTicked?.(item.id, item.status)
    }
    return ok
  } catch (error) {
    onTicked?.(item.id, item.status)
    if (onUnexpected) onUnexpected(error)
    return false
  }
}

/** Single tick for a card holding exactly one actionable item. */
export function SingleTick({ item, onChanged, onTicked }) {
  const completion = useTaskCompletion(item, onChanged)
  const [unexpected, setUnexpected] = useState('')
  const [pending, setPending] = useState(false)
  const done = item.status === 'COMPLETED'
  const toggle = async () => {
    if (pending) return
    setPending(true)
    try { await toggleItemWithSymmetry(completion, item, { onChanged, onTicked, onUnexpected: () => setUnexpected('The tick could not be saved. Try again.') }) }
    finally { setPending(false) }
  }
  return <>
    <button
      type="button"
      className="check-button card-tick"
      disabled={completion.busy || pending}
      aria-pressed={done}
      aria-label={`Mark ${item.title} ${done ? 'incomplete' : 'complete'}`}
      onClick={toggle}
    >{done ? '✓' : ''}</button>
    {unexpected && <span className="form-error" role="alert">{unexpected}</span>}
  </>
}

export default function TabItemRow({ item, onChanged, onTicked, showPriceEditor = false }) {
  const completion = useTaskCompletion(item, onChanged)
  const [unexpected, setUnexpected] = useState('')
  const [pending, setPending] = useState(false)
  const done = item.status === 'COMPLETED'
  const shopping = (item.domains || []).includes('shopping')
  const toggle = async () => {
    if (pending) return
    setPending(true)
    try { await toggleItemWithSymmetry(completion, item, { onChanged, onTicked, onUnexpected: () => setUnexpected('The tick could not be saved. Try again.') }) }
    finally { setPending(false) }
  }
  return <li className={`tab-item-row${done ? ' completed' : ''}`}>
    <button type="button" className="check-button" aria-pressed={done} disabled={completion.busy || pending} aria-label={`Mark ${item.title} ${done ? 'incomplete' : 'complete'}`} onClick={toggle}>{done ? '✓' : ''}</button>
    <span className="tab-item-main"><strong>{item.title}</strong><small>{item.item_type === 'EVENT' ? itemDate(item) : itemDate(item, 'due')}</small></span>
    {shopping && item.amount != null && <span className="shopping-price">{item.currency || ''} {item.amount}</span>}
    {showPriceEditor && shopping && <PriceMenu item={item} completion={completion} onChanged={onChanged} />}
    {completion.recordMsg && <span className="record-message" role="status">{completion.recordMsg}</span>}
    {completion.error && <span className="form-error" role="alert">{completion.error}</span>}
    {unexpected && <span className="form-error" role="alert">{unexpected}</span>}
  </li>
}
