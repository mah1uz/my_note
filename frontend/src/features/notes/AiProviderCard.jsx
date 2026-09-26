import { useEffect, useState } from 'react'
import { useAiKey } from '../../context/AiKeyContext'

export default function AiProviderCard() {
  const { groqApiKey, storedKey, setGroqApiKey, clearGroqApiKey, savePersonalKey, removePersonalKey, trialActive, startTrial, endTrial } = useAiKey()
  const [draftKey, setDraftKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (!justSaved) return undefined
    const timer = window.setTimeout(() => setJustSaved(false), 4000)
    return () => window.clearTimeout(timer)
  }, [justSaved])

  const save = async (event) => {
    event.preventDefault()
    if (!draftKey.trim() || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const status = await savePersonalKey(draftKey)
      setDraftKey('')
      setShowKey(false)
      setJustSaved(true)
      setNotice(`Personal key saved (${status?.masked || '••••'}). It will survive refresh and is used automatically.`)
    } catch (requestError) {
      const message = String(requestError?.message || '')
      if (requestError?.status === 503 && message.includes('SERVER_KEY_SECRET')) {
        setError('Key storage is not configured on the server yet — your key was NOT saved. Use “Use for this session” meanwhile, and set SERVER_KEY_SECRET on the backend service.')
      } else {
        setError(message || 'That key could not be saved. Check the format and try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const useSessionOnly = (event) => {
    event.preventDefault()
    if (!draftKey.trim() || busy) return
    setGroqApiKey(draftKey)
    setDraftKey('')
    setShowKey(false)
    setError('')
    setJustSaved(true)
    setNotice('Session key set. Save it above to keep it after refresh.')
  }

  const clear = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await removePersonalKey()
      setDraftKey('')
      setShowKey(false)
      setNotice('Personal key removed from this account.')
    } catch (requestError) {
      setError(requestError.message || 'The key could not be cleared.')
    } finally {
      setBusy(false)
    }
  }

  const hasStored = Boolean(storedKey?.has_key)
  const status = groqApiKey
    ? 'Personal Groq key active for this session'
    : hasStored
      ? `Saved personal key active (${storedKey.masked}) — survives refresh`
      : trialActive
        ? 'Free trial active for this session — using the shared Groq key'
        : 'No key configured — start the free trial or paste a key below'

  return <section className="provider-card" aria-label="AI Provider">
    <div>
      <span className="eyebrow">AI Provider</span>
      <h2>Groq API Key</h2>
      <p>Saved keys are encrypted per account and reused automatically after refresh. Session-only keys are kept in memory for this browser tab.</p>
    </div>
    <form className="provider-form" onSubmit={save}>
      <label htmlFor="groq-api-key">Groq API Key</label>
      <div className="provider-input-row">
        <input
          id="groq-api-key"
          type={showKey ? 'text' : 'password'}
          value={draftKey}
          onChange={(event) => { setDraftKey(event.target.value); setError(''); }}
          placeholder={groqApiKey || hasStored ? 'Enter a new key to replace it' : 'Paste your key here'}
          autoComplete="off"
        />
        <button type="button" className="button button-ghost" onClick={() => setShowKey((value) => !value)}>
          {showKey ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="provider-actions">
        {!groqApiKey && !hasStored && !trialActive && <button className={`button button-primary${busy ? ' is-busy' : ''}`} type="button" onClick={startTrial} disabled={busy}>Free trial</button>}
        {trialActive && !groqApiKey && !hasStored && <button className="button button-ghost" type="button" onClick={endTrial} disabled={busy}>End trial</button>}
        <button className={`button button-primary${busy ? ' is-busy' : ''}`} type="submit" disabled={busy || !draftKey.trim()}>{busy ? 'Saving…' : justSaved ? 'Updated ✓' : hasStored ? 'Save new key' : 'Save key'}</button>
        <button className="button button-ghost" type="button" onClick={useSessionOnly} disabled={busy || !draftKey.trim()}>Use for this session</button>
        <button className="button button-ghost" type="button" onClick={clear} disabled={busy || (!groqApiKey && !draftKey && !trialActive && !hasStored)}>Clear Key</button>
      </div>
    </form>
    {notice && <p className="form-success" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="provider-status" role="status">{status}</p>
  </section>
}
