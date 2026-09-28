import { useEffect, useState } from 'react'
import { findLinkedTransactionId, updateTransaction } from '../../api/transactionsApi'
import { requestErrorText } from './itemForm'
import { useAuth } from '../../context/AuthContext'

/**
 * Per-item price editor for shopping rows. Shows the current (AI-extracted
 * or previously edited) price, and lets the user add one when missing or
 * correct it. Saving PATCHes the item; when the item is completed and has
 * a linked ledger row, the row is updated in place (or voided when the
 * price is cleared) so the expense list stays perfect.
 */
export default function PriceMenu({ item, completion, onChanged = () => {} }) {
  const { currentUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('')
  const [changeCurrency, setChangeCurrency] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // The account profile can arrive after a user opens the editor. Do not
  // overwrite an existing item currency or an explicit user override.
  useEffect(() => {
    if (open && !item.currency && !changeCurrency && currentUser?.default_currency) {
      setCurrency(currentUser.default_currency)
    }
  }, [open, item.currency, changeCurrency, currentUser?.default_currency])

  const extracted = item.amount != null
    ? `${item.currency || ''} ${item.amount}`.trim()
    : null

  const openMenu = () => {
    setAmount(item.amount ?? '')
    setCurrency(item.currency || currentUser?.default_currency || 'BDT')
    setChangeCurrency(false)
    setError('')
    setMessage('')
    setOpen(true)
  }

  const validate = () => {
    const amountBlank = String(amount).trim() === ''
    if (!amountBlank) {
      const value = Number(amount)
      if (!Number.isFinite(value) || value <= 0) return 'Enter an amount greater than 0, or clear the amount.'
      if (!/^[A-Za-z]{3}$/.test(String(currency).trim())) return 'Currency needs 3 letters, e.g. BDT.'
    }
    return ''
  }

  const savePrice = async () => {
    if (saving || completion.busy) return
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        amount: String(amount).trim() === '' ? null : String(amount).trim(),
        currency: String(amount).trim() === '' ? null : String(currency).trim().toUpperCase(),
      }
      const saved = await completion.save(payload)
      if (!saved) {
        setError(completion.error || 'The price could not be saved. Try again.')
        return
      }
      const linked = completion.recordedId
        || (saved.status === 'COMPLETED' ? await findLinkedTransactionId(item.id) : null)
      if (linked && saved.status === 'COMPLETED') {
        if (payload.amount == null) {
          await completion.voidRecorded(linked)
          setMessage('Price cleared; the recorded expense was removed.')
        } else {
          await updateTransaction(linked, { amount: payload.amount, currency: payload.currency })
          setMessage('Price and ledger entry updated ✓')
        }
      } else {
        setMessage(payload.amount == null ? 'Price cleared.' : 'Price saved. It will be recorded when you tick this item.')
      }
      // No extra refresh here: completion.save already refreshed the items
      // list, and transaction writes notify the ledger on their own.
    } catch (requestError) {
      setError(requestErrorText(requestError))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return <button type="button" className="text-button" onClick={openMenu} aria-label={`Set price for ${item.title}`}>
      {extracted ? `✎ ${extracted}` : 'Add price'}
    </button>
  }

  return <div className="price-menu">
    <p className="field-help">{extracted ? `Current price: ${extracted}` : 'No price set yet — add one below.'}</p>
    <div className="price-input-row">
      <label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" aria-label="Price amount" /></label>
      <div className="price-currency"><span>Currency: <strong>{currency}</strong></span> <button type="button" className="text-button" onClick={() => setChangeCurrency((current) => !current)}>{changeCurrency ? 'Hide currency field' : 'Change currency'}</button>{changeCurrency && <label>Currency<input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} placeholder="BDT" aria-label="Price currency" /></label>}</div>
    </div>
    {error && <p className="form-error" role="alert">{error} <button type="button" className="text-button" onClick={onChanged}>Reload items</button></p>}
    {message && <p className="record-message" role="status">{message}</p>}
    <div className="price-actions">
      <button type="button" className="button button-primary" disabled={saving || completion.busy} onClick={savePrice}>{saving ? 'Saving…' : 'Save price'}</button>
      <button type="button" className="button button-ghost" disabled={saving} onClick={() => setOpen(false)}>Close</button>
    </div>
  </div>
}
