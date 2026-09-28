import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyzeBacklog, summarizeResults } from '../../api/processApi'
import { useAiKey } from '../../context/AiKeyContext'
import { isAiConfigured } from './autoOrganize'

/**
 * Paced, one-note-at-a-time retry. Safe results are confirmed; flagged drafts
 * still require review. Rate limits stop before attempting the rest.
 */
export default function ProcessButtons({ compact = false, backlogCount = 0, onDone }) {
  const { aiProvider, sessionKey, storedKeys, trialActive } = useAiKey()
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [progress, setProgress] = useState(null)
  const controller = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])

  const configured = isAiConfigured({ sessionKey, storedKeys, provider: aiProvider, trialActive })

  const runAnalyzeAll = async () => {
    if (controller.current) return
    controller.current = new AbortController()
    setRunning(true)
    setError('')
    setNeedsSetup(false)
    setSummary(null)
    setProgress(null)
    try {
      const data = await analyzeBacklog(
        { apiKey: sessionKey, trial: trialActive, provider: aiProvider },
        { signal: controller.current.signal, onProgress: setProgress },
      )
      if (controller.current?.signal.aborted) return
      setSummary(summarizeResults(data))
      if (onDone) await onDone(data)
    } catch (requestError) {
      if (controller.current?.signal.aborted) return
      const code = requestError?.data?.code
      if (code === 'credential_required') {
        setNeedsSetup(true)
        setError('Start the free trial or add a personal key to analyze notes.')
      } else {
        setError(requestError.message)
      }
    } finally {
      controller.current = null
      setRunning(false)
    }
  }

  return (
    <div className={compact ? 'process-buttons compact' : 'process-buttons'}>
      <div className="process-actions">
        <button
          className="button button-primary"
          disabled={running || !configured || backlogCount === 0}
          onClick={runAnalyzeAll}
          title={!configured ? 'Start the free trial or add a personal key in Settings' : 'Analyze and categorize waiting notes one by one'}
        >
          {running ? `Analyzing ${progress?.current || 0} of ${progress?.total || 0}…` : 'Analyze all now'}
        </button>
        {!configured && <span className="field-help">AI is not configured. <Link className="text-link" to="/app/settings">Open Settings</Link> to start the trial or add a key.</span>}
      </div>
      {running && progress?.total > 0 && <p className="process-summary" role="status">{progress.results.length} of {progress.total} attempted · {progress.results.filter((row) => row.status === 'confirmed').length} categorized. Waiting between notes to reduce rate limits.</p>}
      {error && <p className="form-error" role="alert">{error}{needsSetup && <> <Link className="text-link" to="/app/settings">Open Settings</Link></>}</p>}
      {summary && (
        <p className="process-summary" role="status">
          {summary.total === 0 ? 'Nothing to process — the backlog is clear.' : (
            <>
              Categorized {summary.confirmed} · Needs review {summary.analyzed} · Failed {summary.failed} · Skipped {summary.skipped}
              {summary.failures.length > 0 && <> ({[...new Set(summary.failures)].join(', ')})</>}
              {summary.stopped === 'trial_exhausted' && '. Stopped: free trial exhausted.'}
              {summary.stopped === 'rate_limit' && '. Stopped: provider rate-limited this run. Wait before retrying the remaining notes; provider limits cannot be bypassed.'}
              {summary.stopped === 'provider_unavailable' && '. Stopped: provider unreachable — skipped notes are untouched.'}
              {summary.stopped === 'invalid_key' && '. Stopped: check your AI key in Settings.'}
              {summary.analyzed > 0 && ' Open flagged or empty drafts to Verify & Review.'}
            </>
          )}
        </p>
      )}
    </div>
  )
}
