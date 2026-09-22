import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createItem, listItems, patchItem } from '../../api/itemsApi'
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

function TaskCard({ item, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => itemForm(item))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  const save = async (changes) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await patchItem(item.id, item.revision, changes)
      if (active.current) onChanged()
    } catch (requestError) {
      if (active.current) setError(requestErrorText(requestError))
    } finally { if (active.current) setBusy(false) }
  }

  return <article className="structured-card">
    <div className={`task-row ${item.status === 'COMPLETED' ? 'completed' : ''}`}>
      <button className="check-button" disabled={busy} aria-label={`Mark ${item.title} ${item.status === 'COMPLETED' ? 'incomplete' : 'complete'}`} onClick={() => save({ status: item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' })}>{item.status === 'COMPLETED' ? '✓' : ''}</button>
      <div className="task-main"><h2>{item.title}</h2><p>{itemDate(item, 'due')}</p><p>{item.domains.join(' · ')}</p></div><span className="pill">{item.importance}</span>
    </div>
    {error && <p role="alert" className="form-error">{error} <button onClick={onChanged}>Reload items</button></p>}
    <div className="review-actions"><Link to={`/app/notes/${item.note}`}>Source note</Link><button className="text-button" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? 'Cancel edit' : 'Edit task'}</button></div>
    {editing && <form onSubmit={(event) => { event.preventDefault(); const payload = itemPayload(form); delete payload.id; save(payload) }}><fieldset disabled={busy} className="draft-item"><legend>Edit task</legend><ItemFields value={form} onChange={setForm} /><button className="button button-primary">{busy ? 'Saving…' : 'Save task'}</button></fieldset></form>}
  </article>
}

function ItemPage({ title, type, empty, shopping = false }) {
  const query = new URLSearchParams({ type, ...(shopping ? { domain: 'shopping', status: 'PENDING' } : {}) }).toString()
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
  return <>
    <header className="page-header"><div><span className="eyebrow">Your confirmed items</span><h1>{title}</h1><p>{shopping ? 'Shopping tasks grouped by text hints. No maps or location tracking.' : 'Only items you have reviewed and confirmed appear here.'}</p></div><div className="page-actions"><button className="button button-ghost" onClick={() => (formOpen ? setFormOpen(false) : openForm())}>{formOpen ? 'Cancel' : `Add ${title.toLowerCase()} manually`}</button><Link className="button button-primary" to="/app/notes">Organize a note</Link></div></header>
    {formOpen && <form className="manual-create" onSubmit={submit}><h2>Add {title.toLowerCase()} manually</h2><p className="field-help">Saved directly without AI. It appears here immediately after creation.</p><ItemFields value={form} onChange={setForm} />{createError && <p role="alert" className="form-error">{createError}</p>}<button className="button button-primary" type="submit" disabled={creating}>{creating ? 'Saving…' : `Save ${title.toLowerCase().replace(/s$/, '')}`}</button></form>}
    {loading ? <p role="status">Loading {title.toLowerCase()}…</p> : error ? <p role="alert" className="form-error">{error} <button onClick={refresh}>Try again</button></p> : items.length === 0 ? <div className="empty-state"><h2>{empty}</h2><p>Save and organize a note to get started.</p></div> : shopping ? <div className="shopping-grid">{Object.entries(groups).map(([name, group]) => <article className="shopping-card" key={name}><h2>{name}</h2><p>{group.length} items</p><ul>{group.map((item) => <li key={item.id}><Link to={`/app/notes/${item.note}`}>{item.title}</Link></li>)}</ul></article>)}</div> : <div className="structured-list">{items.map((item) => type === 'TASK' ? <TaskCard key={`${item.id}-${item.revision}`} item={item} onChanged={refresh} /> : <article className="structured-card" key={item.id}>
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
