import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { askNotes, searchNotes } from '../../api/searchApi'
import { ArrowRightIcon, SearchIcon, SparkleIcon } from '../../components/icons'
import RetroSearchBox from '../../components/RetroSearchBox'

function SearchResult({ result }) {
  const link = result.source_note_id ? `/app/notes/${result.source_note_id}` : null
  const body = <article className="search-result material-result"><div><div className="result-meta"><span className="pill">{result.kind === 'TRANSACTION' ? result.metadata.currency : result.metadata.item_type}</span><span>{result.kind === 'TRANSACTION' ? result.metadata.transaction_at ? new Date(result.metadata.transaction_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '' : result.metadata.status}</span></div><h3>{result.title}</h3><p>{result.excerpt}</p></div>{link ? <ArrowRightIcon size={18} /> : <span className="result-dot">•</span>}</article>
  return link ? <Link to={link}>{body}</Link> : body
}

export default function SearchPage() {
  const [tab, setTab] = useState('search')
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [results, setResults] = useState([])
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  // Guards the auto-run below (StrictMode-safe): each tab+query fires once.
  const submittedRef = useRef('')

  useEffect(() => () => { requestId.current += 1 }, [])

  const runSearch = async (text, mode) => {
    if (!text.trim()) return
    const id = ++requestId.current
    setLoading(true); setError('')
    try {
      const data = mode === 'search' ? await searchNotes(text) : await askNotes(text)
      if (id !== requestId.current) return
      setResults(data.results || []); if (mode === 'ask') setAnswer(data)
    } catch (requestError) { if (id === requestId.current) setError(requestError.message) } finally { if (id === requestId.current) setLoading(false) }
  }

  const submit = (event) => {
    event.preventDefault()
    submittedRef.current = `${tab}:${query.trim()}`
    runSearch(query, tab)
  }

  useEffect(() => {
    const incoming = searchParams.get('q') || ''
    if (incoming) setQuery(incoming)
  }, [searchParams])

  // Execute arrivals from the universal search bar (and tab switches with a
  // query present) instead of leaving a filled-in box with no results.
  useEffect(() => {
    const incoming = (searchParams.get('q') || '').trim()
    if (!incoming) return
    const key = `${tab}:${incoming}`
    if (submittedRef.current === key) return
    submittedRef.current = key
    setQuery(incoming)
    runSearch(incoming, tab)
  }, [searchParams, tab])

  const changeTab = (next) => { setTab(next); setError(''); setAnswer(null) }
  const searching = tab === 'search'
  return <><header className="page-header"><div><span className="eyebrow">Your context layer</span><h1>Search</h1><p>Find the thread, then ask only what your notes can support.</p></div></header><div className="tabs material-tabs"><button className={tab === 'search' ? 'tab active' : 'tab'} onClick={() => changeTab('search')}>Search notes</button><button className={tab === 'ask' ? 'tab active' : 'tab'} onClick={() => changeTab('ask')}>Ask my notes</button></div><section className={tab === 'search' ? 'search-panel material-panel' : 'ask-panel material-panel'}><form className="search-page-form" onSubmit={submit}><RetroSearchBox value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searching ? 'Search notes, tasks, or transactions…' : 'What do you want to know?'} ariaLabel={searching ? 'Search your notes' : 'Ask a question about your notes'} /><button className="button button-primary glow-button" disabled={loading}>{loading ? 'Thinking…' : searching ? 'Search' : 'Ask'}</button></form>{error && <p className="form-error" role="alert">{error}</p>}{searching ? results.length ? <div className="search-results"><div className="result-count"><span className="eyebrow">Lexical matches</span><span>{results.length} result{results.length === 1 ? '' : 's'}</span></div>{results.map((result) => <SearchResult key={`${result.kind}-${result.id}`} result={result} />)}</div> : <div className="search-placeholder"><span className="placeholder-icon"><SearchIcon /></span><h2>Search across your confirmed context</h2><p>Try “expenses over 1000 taka” or “university deadlines”.</p></div> : answer ? <div className="answer-card material-answer"><div className="answer-label"><span className="sparkle"><SparkleIcon size={14} /></span><span>{answer.mode === 'deterministic' ? 'Deterministic answer' : answer.mode === 'grounded' ? 'Grounded answer' : 'Needs a closer look'}</span></div><p>{answer.answer}</p>{answer.sources?.length ? <div className="source-list"><span className="eyebrow">Sources</span>{answer.sources.map((source) => <span className="source" key={source}>#{source}</span>)}</div> : null}{results.length > 0 && <div className="answer-matches"><span className="eyebrow">Matching context</span>{results.map((result) => <SearchResult key={`${result.kind}-${result.id}`} result={result} />)}</div>}</div> : <div className="search-placeholder"><span className="placeholder-icon"><SparkleIcon /></span><h2>Ask a grounded question</h2><p>Answers stay inside your confirmed notes and ledger.</p></div>}</section></>
}
