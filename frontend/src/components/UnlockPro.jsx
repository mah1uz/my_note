import { useEffect, useRef, useState } from 'react'
import { CrownIcon } from './icons'
import { useAuth } from '../context/AuthContext'
import { createProRequest, getProRequest } from '../api/proApi'

/**
 * Unlock Pro entry point: a sidebar card directly above Log out that opens
 * a request modal. There is no Pro-request backend endpoint yet, so submit
 * honestly reports the deferred state instead of inventing a token.
 */
export function UnlockProCard({ onOpen }) {
  return (
    <button type="button" className="pro-card" onClick={onOpen} aria-haspopup="dialog">
      <span className="pro-crown" aria-hidden="true"><CrownIcon size={18} /></span>
      <span className="pro-text">
        <strong>Unlock Pro</strong>
        <small>Unlimited notes, AI insights and more.</small>
      </span>
      <span className="pro-arrow" aria-hidden="true">→</span>
    </button>
  )
}

export function UnlockProModal({ open, onClose }) {
  const { currentUser } = useAuth()
  const [need, setNeed] = useState('')
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [pendingCode, setPendingCode] = useState('')
  const dialogRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    previousFocus.current = document.activeElement
    setState('idle')
    setError('')
    setCode('')
    let active = true
    // An open pending request is shown instead of the form.
    getProRequest()
      .then((current) => { if (active && current?.code) setPendingCode(current.code) })
      .catch((requestError) => {
        if (active && requestError?.status !== 404) setError(requestError.message)
      })
    const dialog = dialogRef.current
    const textarea = dialog?.querySelector('textarea')
    if (textarea) textarea.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
      if (event.key === 'Tab' && dialog) {
        const focusable = [...dialog.querySelectorAll('button, textarea, [href], input:not([disabled])')]
          .filter((element) => !element.disabled)
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (previousFocus.current && previousFocus.current.focus) previousFocus.current.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const submit = async (event) => {
    event.preventDefault()
    if (state === 'saving') return
    setState('saving')
    setError('')
    try {
      const created = await createProRequest(need.trim())
      setCode(created.code)
      setPendingCode(created.code)
      setState('done')
    } catch (requestError) {
      setError(requestError.message)
      setState('idle')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlock-pro-title"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <span className="pro-crown" aria-hidden="true"><CrownIcon size={18} /></span>
          <h2 id="unlock-pro-title">Unlock Pro</h2>
        </div>
        <p className="modal-lede">
          Pro adds unlimited notes and deeper AI insights. Tell us what you
          need it for and an admin will reach out on your account email.
        </p>
        <form onSubmit={submit}>
          <label className="modal-label" htmlFor="pro-need">
            What do you want Pro for? <span>(optional)</span>
          </label>
          <textarea
            id="pro-need"
            rows={3}
            maxLength={500}
            value={need}
            onChange={(event) => setNeed(event.target.value)}
            placeholder="More storage, priority analysis…"
            disabled={state === 'saving' || state === 'done'}
          />
          <label className="modal-label" htmlFor="pro-email">Account email</label>
          <input id="pro-email" type="email" value={currentUser?.email || ''} readOnly aria-readonly="true" />
          {pendingCode && state !== 'done' && (
            <p className="review-message" role="status">
              You already have an open request with code <strong>{pendingCode}</strong>. An admin will reach out on your account email.
            </p>
          )}
          {state === 'done' && (
            <p className="form-success" role="status">Request sent. Your request code is {code}.</p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={state === 'saving' || state === 'done'}>
              {state === 'saving' ? 'Sending…' : state === 'done' ? 'Request sent' : 'Request Pro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
