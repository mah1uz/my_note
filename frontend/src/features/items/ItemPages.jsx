import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createItem, listItems, patchItem } from '../../api/itemsApi'
import { createTransaction, deleteTransaction, listTransactions } from '../../api/transactionsApi'
import { useAuth } from '../../context/AuthContext'
import ItemFields from './ItemFields'
import { itemDate, itemForm, itemPayload, requestErrorText } from './itemForm'

function useItems(query) {
  const { currentUser } = useAuth()
  const [state, setState] = useState({ owner: null, loading: true, items: [], error: '' })
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const owner = currentUser?.id
    setState({ owner, loading: true, items: [], error: '' })
    listItems(query, { signal: controller.signal }).then((items) => {
      if (!controller.signal.aborted) setState({ owner, items, loading: false, error: '' })
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ owner, items: [], loading: false, error: requestErrorText(error) })
    })
    return () => controller.abort()
  }, [query, currentUser?.id, reload])
  return {
    ...(state.owner === currentUser?.id ? state : { items: [], loading: true, error: '' }),
    refresh: () => setReload((value) => value + 1)
  }
}

/**
 * Shared tick + expense-recording logic for task rows. A priced shopping
 * task can become a ledger expense when completed; the ledger row belongs
 * to that completion, so reopening voids it. Recorded state is always
 * re-read from the ledger, never trusted from local memory alone.
 */
function useTaskCompletion(item, onChanged) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const recordable = item.item_type === 'TASK'
    && item.domains.includes('shopping')
    && item.amount != null && item.currency
  const [recordedId, setRecordedId] = useState(null)
  const [recordBusy, setRecordBusy] = useState(false)
  const [recordMsg, setRecordMsg] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  useEffect(() => {
    if (!(recordable && item.status === 'COMPLETED')) {
      setRecordedId(null)
      return
    }
    let live = true
    listTransactions({ note_item: item.id })
      .then((rows) => { if (live) setRecordedId(rows[0]?.id || null) })
      .catch(() => { /* Lookup is a hint; recording still attempts the POST. */ })
    return () => { live = false }
  }, [recordable, item.status, item.id, item.revision])

  const save = async (changes) => {
    if (busy) return false
    setBusy(true)
    setError('')
    try {
      await patchItem(item.id, item.revision, changes)
      if (active.current) onChanged()
      return true
    } catch (requestError) {
      if (active.current) setError(requestErrorText(requestError))
      return false
    } finally { if (active.current) setBusy(false) }
  }

  const toggle = async () => {
    const toCompleted = item.status !== 'COMPLETED'
    const ok = await save({ status: toCompleted ? 'COMPLETED' : 'PENDING' })
    if (!ok || toCompleted || !recordedId) return
    await voidRecorded(recordedId)
  }

  const record = async () => {
    if (recordBusy || recordedId) return false
    setRecordBusy(true)
    setRecordMsg('')
    try {
      const created = await createTransaction({
        note_item: item.id,
        direction: 'DEBIT',
        amount: String(item.amount),
        currency: item.currency,
        label: item.title,
        transaction_at: new Date().toISOString(),
        primary_domain: item.domains.includes('shopping') ? 'shopping' : item.domains[0],
      })
      if (active.current) {
        setRecordedId(created.id)
        setRecordMsg('Recorded as expense.')
      }
      return true
    } catch (requestError) {
      if (active.current) setRecordMsg(requestErrorText(requestError))
      return false
    } finally { if (active.current) setRecordBusy(false) }
  }

  const voidRecorded = async (id) => {
    try {
      await deleteTransaction(id)
      if (active.current) {
        setRecordedId(null)
        setRecordMsg('Recorded expense removed.')
      }
    } catch (requestError) {
      if (active.current) setError(requestErrorText(requestError))
    }
  }

  return { busy, error, recordable, recordedId, recordBusy, recordMsg, save, toggle, record, voidRecorded }
}

function TaskCard({ item, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => itemForm(item))
  const completion = useTaskCompletion(item, onChanged)
  const { busy, error, recordable, recordedId, recordBusy, recordMsg, save, toggle, record } = completion

  return <article className="structured-card">
    <div className={`task-row ${item.status === 'COMPLETED' ? 'completed' : ''}`}>
      <button className="check-button" disabled={busy} aria-label={`Mark ${item.title} ${item.status === 'COMPLETED' ? 'incomplete' : 'complete'}`} onClick={toggle}>{item.status === 'COMPLETED' ? '✓' : ''}</button>
      <div className="task-main"><h2>{item.title}</h2><p>{itemDate(item, 'due')}</p><p>{item.domains.join(' · ')}</p></div><span className="pill">{item.importance}</span>
    </div>
    {error && <p role="alert" className="form-error">{error} <button onClick={onChanged}>Reload items</button></p>}
    {recordable && item.status === 'COMPLETED' && <div className="record-expense">
      {recordedId
        ? <span className="pill pill-success">Recorded as expense</span>
        : <button className="button button-ghost" disabled={recordBusy} onClick={record}>{recordBusy ? 'Recording…' : 'Record as expense'}</button>}
      {recordMsg && <span className="record-message" role="status">{recordMsg}</span>}
    </div>}
    <div className="review-actions"><Link to={`/app/notes/${item.note}`}>Source note</Link><button className="text-button" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? 'Cancel edit' : 'Edit task'}</button></div>
    {editing && <form onSubmit={(event) => { event.preventDefault(); const payload = itemPayload(form); delete payload.id; save(payload) }}><fieldset disabled={busy} className="draft-item"><legend>Edit task</legend><ItemFields value={form} onChange={setForm} /><button className="button button-primary">{busy ? 'Saving…' : 'Save task'}</button></fieldset></form>}
  </article>
}

function ShoppingRow({ item, onChanged }) {
  const completion = useTaskCompletion(item, onChanged)
  const done = item.status === 'COMPLETED'
  // Ticking a priced item completes it and moves the price into the ledger
  // in the same gesture; reopening voids the recorded row (same symmetry as
  // the Tasks page). State changes refresh the list; the ledger lookup on
  // remount is the source of truth, never local memory.
  const completeAndRecord = async () => {
    const linked = completion.recordedId
    const ok = await completion.save({ status: 'COMPLETED' })
    if (!ok) return
    if (completion.recordable && !linked) await completion.record()
  }
  const reopen = async () => {
    const linked = completion.recordedId
    const ok = await completion.save({ status: 'PENDING' })
    if (ok && linked) await completion.voidRecorded(linked)
  }
  return <li className={`shopping-row${done ? ' completed' : ''}`}>
    <button className="check-button" disabled={completion.busy} aria-label={`Mark ${item.title} ${done ? 'incomplete' : 'complete'}`} onClick={done ? reopen : completeAndRecord}>{done ? '✓' : ''}</button>
    <Link to={`/app/notes/${item.note}`}>{item.title}</Link>
    {item.amount != null && <span className="shopping-price">{item.currency || ''} {item.amount}</span>}
    {completion.recordable && done && (completion.recordedId
      ? <span className="pill pill-success">Recorded</span>
      : <button className="text-button" disabled={completion.recordBusy} onClick={() => completion.record()}>{completion.recordBusy ? 'Recording…' : 'Record'}</button>)}
    {completion.recordMsg && <span className="record-message" role="status">{completion.recordMsg}</span>}
    {completion.error && <span className="form-error" role="alert">{completion.error}</span>}
  </li>
}

function ItemPage({ title, type, empty, shopping = false }) {
  const query = new URLSearchParams({ type, ...(shopping ? { domain: 'shopping' } : {}) }).toString()
  const { items, loading, error, refresh } = useItems(query)
  const preset = { item_type: type, domains: shopping ? ['shopping'] : [] }
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(() => itemForm(preset))
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const openForm = () => { setForm(itemForm(preset)); setCreateError(''); setFormOpen(true) }
  const submit = async (event) => {
    event.preventDefault()
    if (creating) return
    const payload = { ...itemPayload(form), item_type: type }
    if (shopping && !payload.domains.includes('shopping')) payload.domains = [...payload.domains, 'shopping']
    if (!payload.title) { setCreateError('A title is required.'); return }
    setCreating(true)
    setCreateError('')
    try {
      await createItem(payload)
      setFormOpen(false)
      refresh()
    } catch (requestError) {
      setCreateError(requestErrorText(requestError))
    } finally {
      setCreating(false)
    }
  }
  const groups = items.reduce((result, item) => {
    const key = item.place_hint || 'No location'
    if (!result[key]) result[key] = []
    result[key].push(item)
    return result
  }, Object.create(null))
  // Events are dated commitments: dateless EVENT items live on Search and
  // their source notes, not here. Every other type renders unfiltered.
  const visible = type === 'EVENT' && !shopping
    ? items.filter((item) => item.start_date || item.due_date || item.start_datetime || item.due_datetime)
    : items
  return <>
    <header className="page-header"><div><span className="eyebrow">Your confirmed items</span><h1>{title}</h1><p>{shopping ? 'Shopping tasks grouped by text hints. No maps or location tracking.' : 'Only items you have reviewed and confirmed appear here.'}</p></div><div className="page-actions"><button className="button button-ghost" onClick={() => (formOpen ? setFormOpen(false) : openForm())}>{formOpen ? 'Cancel' : `Add ${title.toLowerCase()} manually`}</button><Link className="button button-primary" to="/app/notes">Organize a note</Link></div></header>
    {formOpen && <form className="manual-create" onSubmit={submit}><h2>Add {title.toLowerCase()} manually</h2><p className="field-help">Saved directly without AI. It appears here immediately after creation.</p><ItemFields value={form} onChange={setForm} />{createError && <p role="alert" className="form-error">{createError}</p>}<button className="button button-primary" type="submit" disabled={creating}>{creating ? 'Saving…' : `Save ${title.toLowerCase().replace(/s$/, '')}`}</button></form>}
    {loading ? <p role="status">Loading {title.toLowerCase()}…</p> : error ? <p role="alert" className="form-error">{error} <button onClick={refresh}>Try again</button></p> : items.length === 0 ? <div className="empty-state"><h2>{empty}</h2><p>Save and organize a note to get started.</p></div> : shopping ? <div className="shopping-grid">{Object.entries(groups).map(([name, group]) => <article className="shopping-card" key={name}><h2>{name}</h2><p>{group.length} items</p><ul>{group.map((item) => <ShoppingRow key={`${item.id}-${item.revision}`} item={item} onChanged={refresh} />)}</ul></article>)}</div> : visible.length === 0 ? <div className="empty-state"><h2>{empty}</h2><p>Items without dates stay on Search and their source notes.</p></div> : <div className="structured-list">{visible.map((item) => type === 'TASK' ? <TaskCard key={`${item.id}-${item.revision}`} item={item} onChanged={refresh} /> : <article className="structured-card" key={item.id}>
      <div className="domain-list">{item.domains.map((domain) => <span className="pill" key={domain}>{domain}</span>)}</div><h2>{item.title}</h2><p>{item.summary}</p><p>{itemDate(item)}</p>
      {type === 'EXPENSE' && <><strong>{item.amount == null ? 'Amount not specified' : `${item.currency || 'Currency unknown'} ${item.amount}`}</strong>{item.quantity != null && <p>{item.quantity} {item.unit || 'unit unknown'}</p>}</>}
      <Link className="text-link" to={`/app/notes/${item.note}`}>Source note →</Link>
    </article>)}</div>}
  </>
}

export const TasksPage = () => <ItemPage title="Tasks" type="TASK" empty="No tasks yet" />
export const EventsPage = () => <ItemPage title="Events" type="EVENT" empty="No upcoming events" />
export const ExpensesPage = () => <ItemPage title="Expenses" type="EXPENSE" empty="No expenses recorded" />
export const ShoppingPage = () => <ItemPage title="Shopping" type="TASK" empty="No shopping items" shopping />
