import { useState } from 'react'
import { Link } from 'react-router-dom'
import { processAll, summarizeResults } from '../../api/processApi'
import { useAiKey } from '../../context/AiKeyContext'
import { isAiConfigured } from './autoOrganize'

/**
 * Bulk retry for the backlog: analyzes each UNPROCESSED/FAILED note one by
 * one and leaves drafts for per-card Verify & Review (verify mode — never
 * auto-confirms). Per-note review lives on each card/detail page.
 */
export default function ProcessButtons({ compact = false, onDone }) {
  const { aiProvider, sessionKey, storedKeys, trialActive } = useAiKey()
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)

  const configured = isAiConfigured({ sessionKey, storedKeys, provider: aiProvider, trialActive })

  const runAnalyzeAll = async () => {
    if (running) return
    setRunning(true)
    setError('')
    setNeedsSetup(false)
    setSummary(null)
    try {
      const data = await processAll('verify', { apiKey: sessionKey, trial: trialActive, provider: aiProvider })
      setSummary(summarizeResults(data))
      if (onDone) await onDone(data)
    } catch (requestError) {
      const code = requestError?.data?.code
      if (code === 'credential_required') {
        setNeedsSetup(true)
        setError('Start the free trial or add a personal key to analyze notes.')
      } else {
        setError(requestError.message)
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className={compact ? 'process-buttons compact' : 'process-buttons'}>
      <div className="process-actions">
        <button
          className="button button-primary"
          disabled={running || !configured}
          onClick={runAnalyzeAll}
          title={!configured ? 'Start the free trial or add a personal key in Settings' : 'Analyze each waiting note, leaving drafts for per-card review'}
        >
          {running ? 'Analyzing…' : 'Analyze all now'}
        </button>
        {!configured && <span className="field-help">AI is not configured. <Link className="text-link" to="/app/settings">Open Settings</Link> to start the trial or add a key.</span>}
      </div>
      {error && <p className="form-error" role="alert">{error}{needsSetup && <> <Link className="text-link" to="/app/settings">Open Settings</Link></>}</p>}
      {summary && (
        <p className="process-summary" role="status">
          {summary.total === 0 ? 'Nothing to process — the backlog is clear.' : (
            <>
              Drafted for review {summary.analyzed} · Failed {summary.failed} · Skipped {summary.skipped}
              {summary.failures.length > 0 && <> ({[...new Set(summary.failures)].join(', ')})</>}
              {summary.stopped === 'trial_exhausted' && '. Stopped: free trial exhausted.'}
              {summary.stopped === 'provider_unavailable' && '. Stopped: provider unreachable — skipped notes are untouched.'}
              {summary.analyzed > 0 && ' Open each card to Verify & Review.'}
            </>
          )}
        </p>
      )}
    </div>
  )
}
