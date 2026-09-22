import { useState } from 'react'
import { useAiKey } from '../../context/AiKeyContext'

export default function AiProviderCard() {
  const { groqApiKey, setGroqApiKey, clearGroqApiKey, trialActive, startTrial, endTrial } = useAiKey()
  const [draftKey, setDraftKey] = useState('')
  const [showKey, setShowKey] = useState(false)

  const save = (event) => {
    event.preventDefault()
    if (!draftKey.trim()) return
    setGroqApiKey(draftKey)
    setDraftKey('')
    setShowKey(false)
  }

  const clear = () => {
    clearGroqApiKey()
    setDraftKey('')
    setShowKey(false)
  }

  const status = groqApiKey
    ? 'Personal Groq key active for this session'
    : trialActive
      ? 'Free trial active for this session — using the shared Groq key'
      : 'No key configured — start the free trial or paste a key below'

  return <section className="provider-card" aria-label="AI Provider">
    <div>
      <span className="eyebrow">AI Provider</span>
      <h2>Groq API Key</h2>
      <p>Any key you paste is used only for AI requests during this browser session and is not saved by this application. The provider rejects keys it does not accept.</p>
    </div>
    <form className="provider-form" onSubmit={save}>
      <label htmlFor="groq-api-key">Groq API Key</label>
      <div className="provider-input-row">
        <input
          id="groq-api-key"
          type={showKey ? 'text' : 'password'}
          value={draftKey}
          onChange={(event) => setDraftKey(event.target.value)}
          placeholder={groqApiKey ? 'Enter a new key to replace it' : 'Paste your key here'}
          autoComplete="off"
        />
        <button type="button" className="button button-ghost" onClick={() => setShowKey((value) => !value)}>
          {showKey ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="provider-actions">
        {!groqApiKey && !trialActive && <button className="button button-primary" type="button" onClick={startTrial}>Free trial</button>}
        {trialActive && !groqApiKey && <button className="button button-ghost" type="button" onClick={endTrial}>End trial</button>}
        <button className="button button-primary" type="submit" disabled={!draftKey.trim()}>Use for this session</button>
        <button className="button button-ghost" type="button" onClick={clear} disabled={!groqApiKey && !draftKey && !trialActive}>Clear Key</button>
      </div>
    </form>
    <p className="provider-status" role="status">{status}</p>
  </section>
}
