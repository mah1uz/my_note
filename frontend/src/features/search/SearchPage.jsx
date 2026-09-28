import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { askNotes } from '../../api/searchApi'
import { ArrowRightIcon, SearchIcon, SparkleIcon } from '../../components/icons'
import RetroSearchBox from '../../components/RetroSearchBox'
import { useNotes } from '../../context/NotesContext'
import { useConfirmedItems } from '../../context/ItemsContext'
import { getNoteHeading, noteMatchesQuery } from '../notes/noteTaxonomy'
import { previewNote } from '../notes/noteText'

function SourceLink({ id, results }) {
  const result = (results || []).find((entry) => String(entry.id) === String(id))
  if (!result) return null
  const label = result.title || 'Referenced note'
  const target = result.source_note_id ? `/app/notes/${result.source_note_id}` : null
  return target ? <Link className="source" to={target}>{label}</Link> : <span className="source">{label}</span>
}

export default function SearchPage() {
  const [tab, setTab] = useState('search')
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [askQuery, setAskQuery] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const { notes, loading: notesLoading, error: notesError } = useNotes()
  const { items } = useConfirmedItems()

  useEffect(() => () => { requestId.current += 1 }, [])
  // Header searches and shared links populate the Search notes field only.
  useEffect(() => { setQuery(searchParams.get('q') || '') }, [searchParams])

  const itemsByNote = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      const key = String(item.note ?? item.note_id)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    return map
  }, [items])
  const matches = useMemo(() => query.trim() ? notes.filter((note) => noteMatchesQuery(note, itemsByNote.get(String(note.id)) || [], query)) : [], [notes, itemsByNote, query])

  const submit = async (event) => {
    event.preventDefault()
    if (tab !== 'ask' || !askQuery.trim()) return // Search notes filters as you type.
    const id = ++requestId.current
    setLoading(true)
    setError('')
    setAnswer(null)
    try {
      const data = await askNotes(askQuery.trim())
      if (id === requestId.current) setAnswer(data)
    } catch (requestError) {
      if (id === requestId.current) setError(requestError.message)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }
  const changeTab = (next) => { requestId.current += 1; setLoading(false); setTab(next); setError(''); setAnswer(null) }
  const searching = tab === 'search'

  return <><header className="page-header"><div><span className="eyebrow">Your context layer</span><h1>Search</h1><p>Find the thread, then ask only what your notes can support.</p></div></header>
    <div className="tabs material-tabs"><button className={searching ? 'tab active' : 'tab'} onClick={() => changeTab('search')}>Search notes</button><button className={!searching ? 'tab active' : 'tab'} onClick={() => changeTab('ask')}>Ask my notes</button></div>
    <section className={searching ? 'search-panel material-panel' : 'ask-panel material-panel'}>
      <form className="search-page-form" onSubmit={submit}>
        <RetroSearchBox value={searching ? query : askQuery} onChange={(event) => searching ? setQuery(event.target.value) : setAskQuery(event.target.value)} placeholder={searching ? 'Search your written notes…' : 'What do you want to know?'} ariaLabel={searching ? 'Search your notes' : 'Ask a question about your notes'} />
        {!searching && <button className="button button-primary glow-button" disabled={loading}>{loading ? 'Thinking…' : 'Ask'}</button>}
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {searching ? notesLoading ? <p role="status">Loading your notes…</p> : notesError ? <p className="form-error" role="alert">{notesError}</p> : query.trim() ? <div className="search-results"><div className="result-count"><span className="eyebrow">Literal matches</span><span>{matches.length} note{matches.length === 1 ? '' : 's'}</span></div>{matches.map((note) => <Link key={note.id} to={`/app/notes/${note.id}`}><article className="search-result material-result"><div><h3>{getNoteHeading(note, itemsByNote.get(String(note.id)) || [])}</h3><p>{previewNote(note.originalText)}</p></div><ArrowRightIcon size={18} /></article></Link>)}{matches.length === 0 && <p>No written notes match “{query.trim()}”.</p>}</div> : <div className="search-placeholder"><span className="placeholder-icon"><SearchIcon /></span><h2>Search all your written notes</h2><p>Type a word or phrase for instant, case-insensitive matching.</p></div>
        : answer ? <div className="answer-card material-answer"><div className="answer-label"><span className="sparkle"><SparkleIcon size={14} /></span><span>{answer.mode === 'deterministic' ? 'Deterministic answer' : answer.mode === 'grounded' ? 'Grounded answer' : 'Needs a closer look'}</span></div><p>{answer.answer}</p>{answer.sources?.length ? <div className="source-list">{answer.sources.map((id) => <SourceLink key={id} id={id} results={answer.results} />)}</div> : null}</div> : <div className="search-placeholder"><span className="placeholder-icon"><SparkleIcon /></span><h2>Ask a grounded question</h2><p>Ask about your organized notes and transactions. AI will run only when you press Ask.</p></div>}
    </section>
  </>
}
