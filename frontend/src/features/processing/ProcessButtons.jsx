import { useState } from 'react'
import { processAll, summarizeResults } from '../../api/processApi'
import { useAiKey } from '../../context/AiKeyContext'

/**
 * Bulk processing actions shared by the layout banner and the dashboard
 * queue. Analyze All drafts every backlog note; Analyze & Verify drafts
 * and confirms each note's drafts unedited (armed with a second click).
 */
export default function ProcessButtons({ backlogCount, compact = false, onDone }) {
  const { groqApiKey, trialActive } = useAiKey()
  const [running, setRunning] = useState('')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [armVerify, setArmVerify] = useState(false)

  const run = async (mode) => {
    if (running) return
    if (mode === 'verify' && !armVerify) {
      setArmVerify(true)
      return
    }
    setArmVerify(false)
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
        <button
          className="button button-ghost"
          disabled={Boolean(running)}
          aria-pressed={armVerify}
          onClick={() => run('verify')}
        >
          {running === 'verify' ? 'Verifying…' : armVerify ? `Confirm ${backlogCount} notes as-is` : 'Analyze & Verify'}
        </button>
      </div>
      {armVerify && !running && (
        <p className="field-help" role="note">
          Verify confirms AI drafts without review. Press again to proceed, or Analyze All to keep the review step.
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {summary && (
        <p className="process-summary" role="status">
          {summary.total === 0 ? 'Nothing to process — the backlog is clear.' : (
            <>
              Analyzed {summary.analyzed} · Verified {summary.verified} · Failed {summary.failed} · Skipped {summary.skipped}
              {summary.failures.length > 0 && <> ({[...new Set(summary.failures)].join(', ')})</>}
              {summary.stopped === 'trial_exhausted' && '. Stopped: free trial exhausted.'}
            </>
          )}
        </p>
      )}
    </div>
  )
}
