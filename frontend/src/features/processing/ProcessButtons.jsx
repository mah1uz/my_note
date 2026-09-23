import { useState } from 'react'
import { processAll, summarizeResults } from '../../api/processApi'
import { useAiKey } from '../../context/AiKeyContext'

/**
 * Bulk processing actions shared by the layout banner and the dashboard
 * queue. Analyze All is fully automatic: it analyzes and confirms every
 * backlog note with no per-note review step. Verify & Review analyzes
 * only and leaves drafts for manual per-note review.
 */
export default function ProcessButtons({ compact = false, onDone }) {
  const { groqApiKey, trialActive } = useAiKey()
  const [running, setRunning] = useState('')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  const run = async (mode) => {
    if (running) return
    setRunning(mode)
    setError('')
    setSummary(null)
    try {
      const data = await processAll(mode, { apiKey: groqApiKey, trial: trialActive })
      setSummary(summarizeResults(data))
      if (onDone) await onDone(data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setRunning('')
    }
  }

  return (
    <div className={compact ? 'process-buttons compact' : 'process-buttons'}>
      <div className="process-actions">
        <button className="button button-primary" disabled={Boolean(running)} onClick={() => run('analyze')}>
          {running === 'analyze' ? 'Analyzing…' : 'Analyze All'}
        </button>
        <button className="button button-ghost" disabled={Boolean(running)} onClick={() => run('verify')}>
          {running === 'verify' ? 'Reviewing…' : 'Verify & Review'}
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
            </>
          )}
        </p>
      )}
    </div>
  )
}
