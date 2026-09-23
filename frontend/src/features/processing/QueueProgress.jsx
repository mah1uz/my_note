/**
 * Approximate per-note progress, labeled as such. Widths come only from
 * the note's real processingStatus — never from timers — so a stalled
 * request stalls the bar instead of faking completion.
 */
const PHASES = {
  UNPROCESSED: { width: 12, label: 'Queued', tone: '' },
  PROCESSING: { width: 65, label: 'Analyzing…', tone: 'is-active' },
  FAILED: { width: 100, label: 'Needs a retry', tone: 'is-failed' },
  REVIEW_REQUIRED: { width: 100, label: 'Ready to review', tone: 'is-done' },
  PROCESSED: { width: 100, label: 'Done', tone: 'is-done' },
}

export function phaseFor(status) {
  return PHASES[status] || PHASES.UNPROCESSED
}

export default function QueueProgress({ status }) {
  const phase = phaseFor(status)
  return (
    <span className="queue-progress" role="img" aria-label={`${phase.label} (approximate)`}>
      <span className={`queue-bar ${phase.tone}`}>
        <span style={{ width: `${phase.width}%` }} />
      </span>
      <small>approx.</small>
    </span>
  )
}
