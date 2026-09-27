import { useEffect, useState } from 'react'
import { AI_PROVIDERS } from '../../api/aiKeyApi'
import { useAiKey } from '../../context/AiKeyContext'

const PROVIDER_NAMES = { groq: 'Groq', gemini: 'Gemini' }

export default function AiProviderCard() {
  const { aiProvider, setAiProvider, sessionKey, setSessionKey, storedKeys, savePersonalKey, removePersonalKey, trialActive, startTrial, endTrial } = useAiKey()
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

  const stored = storedKeys?.[aiProvider]
  const hasStored = Boolean(stored?.has_key)
  const providerName = PROVIDER_NAMES[aiProvider] || aiProvider

  const save = async (event) => {
    event.preventDefault()
    if (!draftKey.trim() || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const status = await savePersonalKey(draftKey, aiProvider)
      setDraftKey('')
      setShowKey(false)
      setJustSaved(true)
      setNotice(`Personal ${providerName} key saved (${status?.masked || '••••'}). It will survive refresh and is used automatically.`)
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
    setSessionKey(draftKey)
    setDraftKey('')
    setShowKey(false)
    setError('')
    setJustSaved(true)
    setNotice(`Session ${providerName} key set. Save it above to keep it after refresh.`)
  }

  const clear = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await removePersonalKey(aiProvider)
      setDraftKey('')
      setShowKey(false)
      setNotice(`Personal ${providerName} key removed from this account.`)
    } catch (requestError) {
      setError(requestError.message || 'The key could not be cleared.')
    } finally {
      setBusy(false)
    }
  }

  const status = sessionKey
    ? `Personal ${providerName} key active for this session`
    : hasStored
      ? `Saved personal ${providerName} key active (${stored.masked}) — survives refresh`
      : trialActive
        ? 'Free trial active for this session — using the shared server key'
        : 'No key configured — start the free trial or paste a key below'

  return <section className="provider-card" aria-label="AI Provider">
    <div>
      <span className="eyebrow">AI Provider</span>
      <h2>{providerName} API Key</h2>
      <p>Saved keys are encrypted per account and reused automatically after refresh. Session-only keys are kept in memory for this browser tab.</p>
    </div>
    <div className="provider-switch" role="group" aria-label="AI provider">
      {AI_PROVIDERS.map((provider) => (
        <button
          key={provider}
          type="button"
          className={`button ${provider === aiProvider ? 'button-primary' : 'button-ghost'}`}
          aria-pressed={provider === aiProvider}
          disabled={busy}
          onClick={() => { setAiProvider(provider); setError(''); }}
        >
          {PROVIDER_NAMES[provider]}
        </button>
      ))}
    </div>
    <form className="provider-form" onSubmit={save}>
      <label htmlFor="ai-api-key">{providerName} API Key</label>
      <p className="field-help">Groq keys start with <code>gsk_</code> · Gemini API keys start with <code>AIza</code> · any 20–200 character key is accepted — just make sure the matching provider is selected above. In AI Studio, restrict Gemini keys to the Gemini API only: Google rejects unrestricted keys.</p>
      <div className="provider-input-row">
        <input
          id="ai-api-key"
          type={showKey ? 'text' : 'password'}
          value={draftKey}
          onChange={(event) => { setDraftKey(event.target.value); setError(''); }}
          placeholder={sessionKey || hasStored ? 'Enter a new key to replace it' : `Paste your ${providerName} key here`}
          autoComplete="off"
        />
        <button type="button" className="button button-ghost" onClick={() => setShowKey((value) => !value)}>
          {showKey ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="provider-actions">
        {!sessionKey && !hasStored && !trialActive && <button className={`button button-primary${busy ? ' is-busy' : ''}`} type="button" onClick={startTrial} disabled={busy}>Free trial</button>}
        {trialActive && !sessionKey && !hasStored && <button className="button button-ghost" type="button" onClick={endTrial} disabled={busy}>End trial</button>}
        <button className={`button button-primary${busy ? ' is-busy' : ''}`} type="submit" disabled={busy || !draftKey.trim()}>{busy ? 'Saving…' : justSaved ? 'Updated ✓' : hasStored ? 'Save new key' : 'Save key'}</button>
        <button className="button button-ghost" type="button" onClick={useSessionOnly} disabled={busy || !draftKey.trim()}>Use for this session</button>
        <button className="button button-ghost" type="button" onClick={clear} disabled={busy || (!sessionKey && !draftKey && !trialActive && !hasStored)}>Clear Key</button>
      </div>
    </form>
    {notice && <p className="form-success" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="provider-status" role="status">{status}</p>
  </section>
}
