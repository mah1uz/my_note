import { useState } from 'react'
import { useAiKey } from '../../context/AiKeyContext'

export default function AiProviderCard() {
  const { groqApiKey, setGroqApiKey, clearGroqApiKey } = useAiKey()
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

  return <section className="provider-card" aria-label="AI Provider">
    <div>
      <span className="eyebrow">AI Provider</span>
      <h2>Groq API Key</h2>
      <p>Your Groq API key is used only for AI requests during this browser session and is not saved by this application.</p>
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
        <button className="button button-primary" type="submit" disabled={!draftKey.trim()}>Use for this session</button>
        <button className="button button-ghost" type="button" onClick={clear} disabled={!groqApiKey && !draftKey}>Clear Key</button>
      </div>
    </form>
    <p className="provider-status" role="status">{groqApiKey ? 'Personal Groq key active for this session' : 'No personal Groq key configured'}</p>
  </section>
}
