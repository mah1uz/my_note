import { useTaskCompletion } from '../items/ItemPages'
import { itemDate } from '../items/itemForm'

/**
 * One shared tick contract, used by tab rows, card ticks, and the peek
 * modal: ticking a priced shopping item completes it and records the
 * expense; reopening voids the row. Plain tasks and events flip status.
 */
export async function toggleItemWithSymmetry(completion, item) {
  if (completion.busy) return false
  const done = item.status === 'COMPLETED'
  const shopping = (item.domains || []).includes('shopping')
  if (!done) {
    const linked = completion.recordedId
    const ok = await completion.save({ status: 'COMPLETED' })
    if (ok && shopping && completion.recordable && !linked) await completion.record()
    return ok
  }
  const linked = completion.recordedId
  const ok = await completion.save({ status: 'PENDING' })
  if (ok && linked) await completion.voidRecorded(linked)
  return ok
}

/** Single tick for a card holding exactly one actionable item. */
export function SingleTick({ item, onChanged }) {
  const completion = useTaskCompletion(item, onChanged)
  const done = item.status === 'COMPLETED'
  return <button
    className="check-button card-tick"
    disabled={completion.busy}
    aria-label={`Mark ${item.title} ${done ? 'incomplete' : 'complete'}`}
    onClick={() => toggleItemWithSymmetry(completion, item)}
  >{done ? '✓' : ''}</button>
}

export default function TabItemRow({ item, onChanged }) {
  const completion = useTaskCompletion(item, onChanged)
  const done = item.status === 'COMPLETED'
  const shopping = (item.domains || []).includes('shopping')
  return <li className={`tab-item-row${done ? ' completed' : ''}`}>
    <button className="check-button" disabled={completion.busy} aria-label={`Mark ${item.title} ${done ? 'incomplete' : 'complete'}`} onClick={() => toggleItemWithSymmetry(completion, item)}>{done ? '✓' : ''}</button>
    <span className="tab-item-main"><strong>{item.title}</strong><small>{item.item_type === 'EVENT' ? itemDate(item) : itemDate(item, 'due')}</small></span>
    {shopping && item.amount != null && <span className="shopping-price">{item.currency || ''} {item.amount}</span>}
    {completion.recordMsg && <span className="record-message" role="status">{completion.recordMsg}</span>}
    {completion.error && <span className="form-error" role="alert">{completion.error}</span>}
  </li>
}
