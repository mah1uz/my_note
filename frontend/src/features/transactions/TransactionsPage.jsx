import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createTransaction, deleteTransaction, getTransactionSummary, listTransactions, updateTransaction } from '../../api/transactionsApi'

const emptyForm = { direction: 'DEBIT', amount: '', currency: 'BDT', label: '', transaction_at: new Date().toISOString().slice(0, 16) }

function money(value, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value))
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async ({ silent = false } = {}) => {
    // Background reloads (e.g. a tick elsewhere just recorded an expense)
    // must not flash the full-page spinner over existing rows.
    if (!silent) setLoading(true)
    try {
      const params = filter === 'ALL' ? {} : { direction: filter }
      const [rows, totals] = await Promise.all([listTransactions(params), getTransactionSummary(params)])
      setTransactions(rows)
      setSummary(totals.currencies || [])
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onLedgerChanged = () => load({ silent: true })
    window.addEventListener('rememberly:transactions-changed', onLedgerChanged)
    return () => window.removeEventListener('rememberly:transactions-changed', onLedgerChanged)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const payload = { ...form, amount: form.amount, transaction_at: new Date(form.transaction_at).toISOString() }
      if (editing) await updateTransaction(editing, payload)
      else await createTransaction(payload)
      setForm(emptyForm)
      setEditing(null)
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const edit = (transaction) => {
    setEditing(transaction.id)
    setForm({ direction: transaction.direction, amount: transaction.amount, currency: transaction.currency, label: transaction.label, transaction_at: transaction.transaction_at.slice(0, 16) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this transaction?')) return
    try { await deleteTransaction(id); await load() } catch (requestError) { setError(requestError.message) }
  }

  return <>
    <header className="page-header material-page-header">
      <div><span className="eyebrow">Authoritative ledger</span><h1>Transactions</h1><p>Keep confirmed money movement clear, separate, and yours.</p></div>
      <Link className="button button-primary" to="/app/notes">Review notes <span>→</span></Link>
    </header>
    <section className="ledger-summary" aria-label="Transaction summary">
      {summary.length ? summary.map((item) => <article className="ledger-total" key={item.currency}><span className="eyebrow">{item.currency} balance</span><strong className={Number(item.balance) < 0 ? 'negative' : ''}>{money(item.balance, item.currency)}</strong><div><span>In {money(item.credits, item.currency)}</span><span>Out {money(item.debits, item.currency)}</span></div></article>) : <article className="ledger-total ledger-total-empty"><span className="eyebrow">Your ledger</span><strong>No entries yet</strong><p>Add your first transaction below.</p></article>}
    </section>
    <section className="transaction-layout">
      <form className="surface-card transaction-form" onSubmit={submit}>
        <div className="card-heading"><div><span className="eyebrow">{editing ? 'Update entry' : 'New entry'}</span><h2>{editing ? 'Edit transaction' : 'Add a transaction'}</h2></div>{editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setForm(emptyForm) }}>Cancel</button>}</div>
        <div className="segmented-control" aria-label="Transaction direction"><button type="button" className={form.direction === 'DEBIT' ? 'selected debit' : ''} onClick={() => setForm({ ...form, direction: 'DEBIT' })}>Money out</button><button type="button" className={form.direction === 'CREDIT' ? 'selected credit' : ''} onClick={() => setForm({ ...form, direction: 'CREDIT' })}>Money in</button></div>
        <label>Label<input required maxLength="255" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Books, salary, rent…" /></label>
        <div className="form-grid-two"><label>Amount<input required min="0.0001" step="0.0001" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></label><label>Currency<input required maxLength="3" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} placeholder="BDT" /></label></div>
        <label>Date and time<input required type="datetime-local" value={form.transaction_at} onChange={(event) => setForm({ ...form, transaction_at: event.target.value })} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-wide" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}</button>
      </form>
      <section className="surface-card transaction-list-card">
        <div className="card-heading"><div><span className="eyebrow">Confirmed entries</span><h2>Ledger activity</h2></div><div className="segmented-control compact"><button className={filter === 'ALL' ? 'selected' : ''} onClick={() => setFilter('ALL')}>All</button><button className={filter === 'DEBIT' ? 'selected' : ''} onClick={() => setFilter('DEBIT')}>Out</button><button className={filter === 'CREDIT' ? 'selected' : ''} onClick={() => setFilter('CREDIT')}>In</button></div></div>
        {loading ? <div className="loading-state">Loading your ledger…</div> : transactions.length ? <div className="transaction-list">{transactions.map((transaction) => <article className="transaction-row" key={transaction.id}><div className={`transaction-symbol ${transaction.direction.toLowerCase()}`}>{transaction.direction === 'CREDIT' ? '↑' : '↓'}</div><div className="transaction-main"><strong>{transaction.label}</strong><span>{new Date(transaction.transaction_at).toLocaleDateString(undefined, { dateStyle: 'medium' })} · {transaction.source_kind === 'AI_NOTE' ? 'From note' : 'Manual'}</span></div><strong className={`transaction-amount ${transaction.direction.toLowerCase()}`}>{transaction.direction === 'CREDIT' ? '+' : '-'}{money(transaction.amount, transaction.currency)}</strong><div className="transaction-actions"><button className="text-button" onClick={() => edit(transaction)}>Edit</button><button className="text-button danger-text" onClick={() => remove(transaction.id)}>Delete</button></div></article>)}</div> : <div className="empty-state compact-empty"><div className="empty-icon">+</div><h3>No matching entries</h3><p>Use the form to make your first confirmed ledger entry.</p></div>}
      </section>
    </section>
  </>
}
