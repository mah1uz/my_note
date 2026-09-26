import { useState } from 'react'
import { processAll, summarizeResults } from '../../api/processApi'
import { useAiKey } from '../../context/AiKeyContext'

/**
 * Manual backlog verification, shown only in the All Notes section.
 * Verify & Review analyzes each backlog note and leaves drafts for
 * per-note review. (Automatic organization now runs on every save, and
 * per-note retry lives on the note card and detail page.)
 */
export default function ProcessButtons({ compact = false, onDone }) {
  const { groqApiKey, trialActive } = useAiKey()
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  const runVerify = async () => {
    if (running) return
    setRunning(true)
    setError('')
    setSummary(null)
    try {
      const data = await processAll('verify', { apiKey: groqApiKey, trial: trialActive })
      setSummary(summarizeResults(data))
      if (onDone) await onDone(data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className={compact ? 'process-buttons compact' : 'process-buttons'}>
      <div className="process-actions">
        <button className="button button-ghost" disabled={running} onClick={runVerify}>
          {running ? 'Reviewing…' : 'Verify & Review'}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {summary && (
        <p className="process-summary" role="status">
          {summary.total === 0 ? 'Nothing to process — the backlog is clear.' : (
            <>
              Confirmed {summary.confirmed} · Drafted for review {summary.analyzed} · Failed {summary.failed} · Skipped {summary.skipped}
              {summary.failures.length > 0 && <> ({[...new Set(summary.failures)].join(', ')})</>}
              {summary.stopped === 'trial_exhausted' && '. Stopped: free trial exhausted.'}
              {summary.stopped === 'provider_unavailable' && '. Stopped: provider unreachable — skipped notes are untouched.'}
            </>
          )}
        </p>
      )}
    </div>
  )
}
