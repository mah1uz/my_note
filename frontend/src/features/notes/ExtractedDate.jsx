import { itemDate } from '../items/itemForm'

/** A proposed outcome date from a structured item, not the note's saved date. */
export default function ExtractedDate({ item, showTitle = false }) {
  if (!item || item.item_type === 'EXPENSE') return null
  const prefix = item.item_type === 'EVENT' && (item.start_date || item.start_datetime) ? 'start'
    : item.due_date || item.due_datetime ? 'due' : 'start'
  if (!item[`${prefix}_date`] && !item[`${prefix}_datetime`]) return null
  return <span className="extracted-date">
    {showTitle && <span>{item.title}: </span>}
    <span>Estimated outcome date: </span><strong>{itemDate(item, prefix)}</strong>
  </span>
}
