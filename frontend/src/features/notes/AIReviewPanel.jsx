import { useEffect, useRef, useState } from 'react'
import { analyzeNote, confirmAnalysis, getReview } from '../../api/itemsApi'
import { useAuth } from '../../context/AuthContext'
import { useAiKey } from '../../context/AiKeyContext'
import ItemFields, { Confidence } from '../items/ItemFields'
import { itemDate, itemForm, itemPayload, requestErrorText } from '../items/itemForm'

export default function AIReviewPanel({ note, onNoteChanged, disabled = false }) {
  const { currentUser } = useAuth()
  const { groqApiKey, clearGroqApiKey } = useAiKey()
  const [review, setReview] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)
  const generation = useRef(0)
  const draftId = useRef(0)

  const applyReview = (data) => {
    setReview(data)
    setDrafts(data.items.filter((item) => !item.is_confirmed).map((item) => ({ ...itemForm(item), key: `saved-${item.id}` })))
  }

  useEffect(() => {
    const version = ++generation.current
    setLoading(true)
    setReview(null)
    setDrafts([])
    getReview(note.id).then((data) => {
      if (generation.current === version) applyReview(data)
    }).catch((requestError) => {
      if (generation.current === version) setError(requestErrorText(requestError))
    }).finally(() => { if (generation.current === version) setLoading(false) })
    return () => { generation.current++ }
  }, [note.id, note.revision, currentUser?.id, reload])

  const run = async (action) => {
    if (busy || !review) return
    const version = generation.current
    setBusy(action)
    setError('')
    setMessage('')
    try {
      const data = action === 'analyze'
         ? await analyzeNote(note.id, review.note.revision, groqApiKey)
        : await confirmAnalysis(note.id, review.note.revision, drafts.map(itemPayload))
      if (version !== generation.current) return
      applyReview(data)
      setMessage(action === 'analyze' ? 'Analysis ready. Review every item before confirming.' : 'Organization confirmed and saved.')
      await onNoteChanged()
    } catch (requestError) {
      if (version !== generation.current) return
      if (requestError?.data?.code === 'invalid_key') clearGroqApiKey()
      setError(requestErrorText(requestError))
      // Provider failures increment the revision; fetch the saved review before retry/manual work.
      // Validation/conflict errors preserve local edits until the user explicitly reloads.
      if (action === 'analyze') {
        try {
          const data = await getReview(note.id)
          if (version === generation.current) applyReview(data)
        } catch { /* The original error remains visible, with a reload action. */ }
      }
    } finally { setBusy('') }
  }

  const addManual = () => {
    setDrafts((items) => [...items, { ...itemForm(), key: `manual-${++draftId.current}` }])
    setMessage('Added a manual item. Fill its title and confirm when ready.')
  }

  const confirmed = review?.items.filter((item) => item.is_confirmed) || []
  const locked = Boolean(busy || disabled || review?.analysis_running)
  const reviewable = drafts.length > 0 || review?.note.processing_status === 'REVIEW_REQUIRED'

  return <section className="ai-review" aria-label="AI organization">
    <div className="section-heading"><div><span className="eyebrow">Organize after capture</span><h2>AI review</h2></div></div>
    <p className="field-help">Analyze sends this saved note to Groq. Your original stays saved even if AI fails. Confidence is a review signal, not a guarantee.</p>
    {loading && <p role="status">Loading organization…</p>}
    {error && <div role="alert" className="form-error">{error} <button type="button" onClick={() => { setError(''); setReload((value) => value + 1) }} disabled={Boolean(busy)}>Reload saved review</button></div>}
    {message && <p role="status" className="review-message">{message}</p>}
    {review && !loading && <>
      {review.note.processing_status === 'FAILED' && <p className="form-error">AI organization failed. Your note is saved.</p>}
      {review.analysis_running && <p role="status">Analysis is running. Reload after it finishes; abandoned requests can be retried after two minutes.</p>}
      <div className="review-actions">
        <button className="button button-primary" disabled={locked} onClick={() => run('analyze')}>{busy === 'analyze' ? 'Analyzing…' : review.note.processing_status === 'UNPROCESSED' ? 'Analyze note' : 'Retry AI Analysis'}</button>
        <button className="button button-ghost" disabled={locked || drafts.length >= 10} onClick={addManual}>{drafts.length ? 'Add missing item' : 'Organize Manually'}</button>
        {review.analysis_running && <button className="button button-ghost" onClick={() => setReload((value) => value + 1)}>Reload status</button>}
      </div>
      <p className="field-help">Retry replaces unconfirmed drafts only after success. Confirmed items stay unchanged; remove any overlapping new candidates before confirming.</p>
      {confirmed.length > 0 && <div className="confirmed-items"><h3>Confirmed items</h3>{confirmed.map((item) => <article key={item.id} className="confirmed-item">
        <span className="pill">{item.item_type}</span><h4>{item.title}</h4><p>{item.summary}</p><p>{item.domains.join(' · ')}</p>
        <p>{itemDate(item, item.item_type === 'TASK' ? 'due' : 'start')}</p>
        {item.amount != null && <p>{item.currency || 'Currency unknown'} {item.amount}</p>}
        {item.quantity != null && <p>{item.quantity} {item.unit || 'unit unknown'}</p>}
      </article>)}<p className="field-help">Confirmed items are snapshots of your approved facts. Editing raw text does not overwrite them. Tasks can be edited on the Tasks page.</p></div>}
      {!drafts.length && <p className="review-empty">{review.note.processing_status === 'REVIEW_REQUIRED' ? 'No structured items found. Add a manual item, retry, or confirm an empty review.' : 'No unconfirmed items. Analyze the note or organize it manually.'}</p>}
      <form onSubmit={(event) => { event.preventDefault(); run('confirm') }}>
        {drafts.map((draft, index) => <fieldset className="draft-item" key={draft.key} disabled={locked}>
          <legend>Item {index + 1}</legend><Confidence value={draft.confidence} />
          <ItemFields value={draft} domainOptions={review.domains.map((domain) => domain.slug)} onChange={(value) => setDrafts((items) => items.map((item) => item.key === draft.key ? value : item))} />
          <button type="button" className="button button-danger" aria-label={`Remove item ${index + 1}`} onClick={() => setDrafts((items) => items.filter((item) => item.key !== draft.key))}>Remove item</button>
        </fieldset>)}
        {reviewable && <button className="button button-primary" type="submit" disabled={locked}>{busy === 'confirm' ? 'Confirming…' : drafts.length ? 'Confirm all' : 'Confirm empty review'}</button>}
      </form>
    </>}
  </section>
}
