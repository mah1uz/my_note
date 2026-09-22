import { domains, importances, itemStatuses, itemTypes } from './itemForm'

export function Confidence({ value }) {
  if (value == null) return <span className="confidence">Manual / confidence not provided</span>
  const level = value < 0.60 ? 'low' : value < 0.85 ? 'review' : 'normal'
  return <span className={`confidence confidence-${level}`}>
    {Math.round(value * 100)}% · {level === 'low' ? 'Uncertain — check carefully' : level === 'review' ? 'Needs careful review' : 'Review before confirming'}
  </span>
}

export default function ItemFields({ value, onChange, domainOptions = domains }) {
  const set = (key, next) => onChange({ ...value, [key]: next })
  const options = (values) => values.map((option) => <option key={option} value={option}>{option}</option>)
  return <div className="item-fields">
    <label>Type<select value={value.item_type} onChange={(e) => set('item_type', e.target.value)}>{options(itemTypes)}</select></label>
    <label>Title<input value={value.title} onChange={(e) => set('title', e.target.value)} required maxLength={200} /></label>
    <label className="field-wide">Summary / uncertainty<textarea value={value.summary} onChange={(e) => set('summary', e.target.value)} maxLength={500} rows={2} /></label>
    <fieldset className="domain-options field-wide"><legend>Domains</legend>{domainOptions.map((slug) => <label key={slug}>
      <input type="checkbox" checked={value.domains.includes(slug)} onChange={(e) => set('domains', e.target.checked ? [...value.domains, slug] : value.domains.filter((domain) => domain !== slug))} />{slug}
    </label>)}</fieldset>
    <p className="field-wide field-help">Dates and times use Asia/Dhaka. Leave time empty when only the date is known.</p>
    {['start', 'due'].map((prefix) => <div className="date-fields" key={prefix}>
      <label>{prefix === 'start' ? 'Start / expense date' : 'Due date'}<input type="date" value={value[`${prefix}Date`]} onChange={(e) => onChange({ ...value, [`${prefix}Date`]: e.target.value, ...(!e.target.value ? { [`${prefix}Time`]: '' } : {}) })} /></label>
      <label>{prefix === 'start' ? 'Start time (optional)' : 'Due time (optional)'}<input type="time" disabled={!value[`${prefix}Date`]} value={value[`${prefix}Time`]} onChange={(e) => set(`${prefix}Time`, e.target.value)} /></label>
    </div>)}
    <label>Amount<input type="number" min="0" max="9999999999.99" step="0.01" value={value.amount} onChange={(e) => set('amount', e.target.value)} /></label>
    <label>Currency (e.g. BDT)<input value={value.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} maxLength={3} pattern="[A-Z]{3}" placeholder="Unknown" /></label>
    <label>Quantity<input type="number" min="0" max="999999999.999" step="0.001" value={value.quantity} onChange={(e) => set('quantity', e.target.value)} /></label>
    <label>Unit<input value={value.unit} onChange={(e) => set('unit', e.target.value)} maxLength={20} placeholder="e.g. gram" /></label>
    <label>Place hint<input value={value.place_hint} onChange={(e) => set('place_hint', e.target.value)} maxLength={120} /></label>
    <label>Importance<select value={value.importance} onChange={(e) => set('importance', e.target.value)}>{options(importances)}</select></label>
    <label>Status<select value={value.status} onChange={(e) => set('status', e.target.value)}>{options(itemStatuses)}</select></label>
  </div>
}
