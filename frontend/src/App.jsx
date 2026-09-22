import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAppState } from './context/AppStateContext'
import { useAuth } from './context/AuthContext'
import { useNotes } from './context/NotesContext'
import { confirmPasswordReset, requestPasswordReset } from './api/authApi'
import { mockAskResponse, mockSearchResults } from './data/mockData'
import AIReviewPanel from './features/notes/AIReviewPanel'
import { EventsPage, ExpensesPage, ShoppingPage, TasksPage } from './features/items/ItemPages'
import AiProviderCard from './features/notes/AiProviderCard'
import { clearSessionGroqKey } from './context/AiKeyContext'
import GoogleSignInButton from './components/GoogleSignInButton'

const navItems = [
  ['Dashboard', '/app', '⌂'], ['Notes', '/app/notes', '▤'], ['Tasks', '/app/tasks', '✓'],
  ['Events', '/app/events', '◷'], ['Shopping', '/app/shopping', '▢'], ['Expenses', '/app/expenses', '৳'],
  ['Places', '/app/places', '⌖'], ['Search', '/app/search', '⌕'], ['Settings', '/app/settings', '⚙']
]

function Pill({ children, tone = 'neutral' }) { return <span className={`pill pill-${tone.toLowerCase()}`}>{children}</span> }

function EmptyState({ title, text }) {
  return <div className="empty-state"><div className="empty-icon">○</div><h3>{title}</h3><p>{text}</p></div>
}

function PageHeader({ eyebrow, title, description, action }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>
}

function Sidebar({ onLogout, open }) {
  return <aside className={`sidebar${open ? ' open' : ' closed'}`}>
    <Link className="brand" to="/app"><span className="brand-mark">R</span><span>rememberly</span></Link>
    <div className="sidebar-label">Your space</div>
    <nav className="sidebar-nav" aria-label="Your space">{navItems.map(([label, path, icon]) => <NavLink key={path} to={path} end={path === '/app'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><span className="nav-icon">{icon}</span>{label}</NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="prototype-note"><span className="status-dot" /> Prototype data</div><button className="logout-button" onClick={onLogout}>Log out <span>↗</span></button></div>
  </aside>
}

function MobileNav() {
  return <nav className="mobile-nav">{navItems.slice(0, 5).map(([label, path, icon]) => <NavLink key={path} to={path} end={path === '/app'} className={({ isActive }) => isActive ? 'mobile-link active' : 'mobile-link'}><span>{icon}</span><small>{label}</small></NavLink>)}</nav>
}

function AppLayout({ children }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const handleLogout = async () => { try { await logout() } finally { clearSessionGroqKey(); navigate('/login') } }
  return <div className="app-shell">
    <Sidebar open={navOpen} onLogout={handleLogout} />
    <main className="main-content"><div className="topbar"><button className="menu-button" onClick={() => setNavOpen(!navOpen)} aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen}>☰</button><Link className="brand" to="/app"><span className="brand-mark">R</span><span>rememberly</span></Link></div><div className="mobile-topbar"><Link className="brand" to="/app"><span className="brand-mark">R</span><span>rememberly</span></Link><button className="menu-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">☰</button></div>{mobileOpen && <div className="mobile-menu">{navItems.map(([label, path]) => <NavLink key={path} to={path} onClick={() => setMobileOpen(false)} className="mobile-menu-link">{label}</NavLink>)}<button onClick={handleLogout}>Log out</button></div>}<div className="content-wrap" key={location.pathname}>{children}</div></main>
    <MobileNav />
  </div>
}

function QuickCapture({ compact = false }) {
  const { addNote } = useNotes()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedNoteId, setSavedNoteId] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async (event) => {
    event.preventDefault()
    if (!text.trim() || saving) return
    setSaving(true)
    try {
      const note = await addNote(text)
      setSavedNoteId(note.id)
      setText('')
      setError('')
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2400)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }
  return <form className={`capture-card ${compact ? 'capture-compact' : ''}`} onSubmit={save}>
    <div className="capture-heading"><span className="capture-icon">✦</span><div><h2>Quick capture</h2><p>Get it out of your head. We&apos;ll help organize it.</p></div></div>
    <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="What do you want to remember?" rows={compact ? 3 : 4} aria-label="What do you want to remember?" />
    {error && <p className="form-error">{error}</p>}<div className="capture-footer"><span className={saved ? 'save-message visible' : 'save-message'}>{saved ? 'Saved as an unprocessed note' : 'Try: “I need eggs from Agora.”'}</span><div className="capture-actions">{savedNoteId && <Link className="button button-ghost" to={`/app/notes/${savedNoteId}`}>Review saved note</Link>}<button className="button button-ghost" type="button" onClick={() => navigate('/app/notes/new')}>Open full editor</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save note'} <span>↗</span></button></div></div>
  </form>
}

function DashboardPage() {
  const { dashboardItems, tasks } = useAppState()
  const { currentUser } = useAuth()
  return <><PageHeader eyebrow="Monday, September 21" title={`Good morning, ${currentUser?.name || 'there'}`} description="A calm place for everything you want to remember." /><QuickCapture /><section className="section-block"><div className="section-heading"><div><span className="eyebrow">Stay in the loop</span><h2>What matters now</h2></div><Link to="/app/tasks" className="text-link">See all tasks <span>→</span></Link></div><div className="matter-grid">{dashboardItems.map((item) => <article className="matter-card" key={item.id}><div className="matter-top"><Pill tone={item.priority}>{item.type}</Pill><span className={`priority priority-${item.priority.toLowerCase()}`} /> </div><h3>{item.title}</h3><p>{item.reason}</p><span className="card-domain">{item.domain}</span></article>)}</div></section><section className="dashboard-grid"><div className="summary-card"><div className="section-heading"><div><span className="eyebrow">At a glance</span><h2>Today&apos;s rhythm</h2></div><span className="date-chip">Sep 21</span></div><div className="summary-list"><div><span className="summary-number">{tasks.filter((task) => task.status !== 'DONE').length}</span><span>Tasks</span></div><div><span className="summary-number">1</span><span>Event</span></div><div><span className="summary-number">৳250</span><span>Expenses</span></div></div></div><div className="briefing-card"><span className="eyebrow">Daily briefing · prototype</span><h2>A little room to breathe</h2><p>You have a focused day ahead. Your EM quiz is coming up, and there are three small tasks waiting for you.</p><Link to="/app/search" className="button button-light">Ask your notes <span>→</span></Link></div></section></>
}

function NoteCard({ note, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const remove = async () => { if (deleting) return; setDeleting(true); try { await onDelete(note.id) } catch { setDeleting(false) } }
  return <article className="note-card"><div className="note-card-top"><Pill tone="success">{note.processingStatus}</Pill><span className="note-date">{new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div><Link to={`/app/notes/${note.id}`} className="note-title">{note.originalText}</Link><div className="note-card-items"><span>Original saved · open to review or organize</span></div><div className="note-card-bottom"><div className="domain-list" /><div className="card-actions"><Link to={`/app/notes/${note.id}`} aria-label={`View ${note.originalText}`}>View</Link><button onClick={remove} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button></div></div></article>
}

function NotesPage() {
  const { notes, loading, error, deleteNote } = useNotes()
  return <><PageHeader eyebrow="Your memory" title="Notes" description={`${notes.length} thoughts saved to your account.`} action={<Link className="button button-primary" to="/app/notes/new">+ New note</Link>} />{loading ? <div className="loading-state">Loading your notes…</div> : error ? <div className="form-error">{error}</div> : notes.length ? <div className="notes-list">{notes.map((note) => <NoteCard key={note.id} note={note} onDelete={deleteNote} />)}</div> : <EmptyState title="No notes yet" text="Start with a quick capture and give your thoughts somewhere to land." />}</>
}

function NewNotePage() {
  const { addNote } = useNotes()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async (event) => { event.preventDefault(); if (!text.trim()) { setError('A note cannot be empty.'); return } if (saving) return; setSaving(true); try { const note = await addNote(text); navigate(`/app/notes/${note.id}`) } catch (requestError) { setError(requestError.message); setSaving(false) } }
  return <><PageHeader eyebrow="Capture first" title="New note" description="Write naturally. No categories or forms to fill out first." /><div className="editor-layout"><form className="editor-card" onSubmit={save}><label htmlFor="note-editor">Your thought</label><textarea id="note-editor" value={text} onChange={(event) => setText(event.target.value)} placeholder="I have an EM quiz on September 23..." rows="12" autoFocus />{error && <p className="form-error">{error}</p>}<div className="editor-footer"><span>{text.length} characters</span><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save note'} <span>↗</span></button></div></form><div className="editor-tip"><span className="tip-icon">✦</span><h3>Captured now, organized later</h3><p>Save first, then analyze with AI or organize manually. Review and correct suggested items before confirming them.</p><div className="example-note">“Tomorrow class at 10, buy eggs afterwards, and spent ৳250 on books.”</div></div></div></>
}

function NoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notes, loading, loadNote, updateNote, deleteNote } = useNotes()
  const note = notes.find((item) => item.id === id)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [detailLoading, setDetailLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState('')
  useEffect(() => { if (note) setText(note.originalText) }, [note])
  useEffect(() => {
    let active = true
    setDetailLoading(true)
    loadNote(id).then(() => { if (active) setDetailError('') }).catch((requestError) => { if (active) setDetailError(requestError.message) }).finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [id])
  if (loading || detailLoading) return <div className="loading-state">Loading note…</div>
  if (detailError || !note) return <EmptyState title="Note not found" text={detailError || 'This note may have been deleted or is no longer available.'} />
  const save = async () => { if (!text.trim()) { setError('A note cannot be empty.'); return } if (pendingAction) return; setPendingAction('save'); try { await updateNote(note.id, text); setEditing(false); setError('') } catch (requestError) { setError(requestError.message) } finally { setPendingAction('') } }
  const remove = async () => { if (pendingAction) return; setPendingAction('delete'); try { await deleteNote(note.id); navigate('/app/notes') } catch (requestError) { setError(requestError.message); setPendingAction('') } }
  return <><Link to="/app/notes" className="back-link">← Back to notes</Link><div className="detail-header"><div><span className="eyebrow">Note detail</span><h1>Captured thought</h1><p>{new Date(note.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><div className="header-actions"><button className="button button-ghost" onClick={() => setEditing(!editing)} disabled={Boolean(pendingAction)}>{editing ? 'Cancel' : 'Edit'}</button><button className="button button-danger" onClick={remove} disabled={Boolean(pendingAction)}>{pendingAction === 'delete' ? 'Deleting…' : 'Delete'}</button></div></div>{error && <p className="form-error">{error}</p>}<div className="detail-card"><div className="original-note"><span className="eyebrow">Original note</span>{editing ? <textarea aria-label="Original note text" value={text} onChange={(event) => setText(event.target.value)} rows="5" /> : <p>{note.originalText}</p>}{editing && <><p className="field-help">Saving edits discards unconfirmed drafts. Previously confirmed facts stay unchanged.</p><button className="button button-primary" onClick={save} disabled={Boolean(pendingAction)}>{pendingAction === 'save' ? 'Saving…' : 'Save changes'}</button></>}</div><div className="detail-meta"><Pill tone="success">{note.processingStatus}</Pill><span>Owned by your account</span></div></div><AIReviewPanel note={note} disabled={editing || Boolean(pendingAction)} onNoteChanged={() => loadNote(note.id)} /></>
}

function PlacesPage() {
  const { places, addPlace, updatePlace, deletePlace } = useAppState()
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const startEdit = (place) => { setEditingId(place.id); setName(place.name); setAddress(place.address); setFormOpen(true) }
  const closeForm = () => { setEditingId(null); setName(''); setAddress(''); setFormOpen(false) }
  const save = (event) => { event.preventDefault(); if (!name.trim()) return; const changes = { name: name.trim(), address: address.trim() || 'Address to be added' }; if (editingId) updatePlace(editingId, changes); else addPlace({ ...changes, radius: 200 }); closeForm() }
  return <><PageHeader eyebrow="Context, later" title="Places" description="Saved places for a future, smarter reminder experience." action={<button className="button button-primary" onClick={() => { if (formOpen) closeForm(); else { setEditingId(null); setFormOpen(true) } }}>{formOpen ? 'Cancel' : '+ Add place'}</button>} />{formOpen && <form className="inline-form" onSubmit={save}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Place name" aria-label="Place name" required /><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Mock address" aria-label="Mock address" /><button className="button button-primary">{editingId ? 'Save changes' : 'Save place'}</button></form>}{places.length ? <div className="places-grid">{places.map((place) => <article className="place-card" key={place.id}><div className="place-card-top"><span className="place-icon">⌖</span><button className="icon-button" aria-label={`Delete ${place.name}`} onClick={() => deletePlace(place.id)}>×</button></div><h2>{place.name}</h2><p>{place.address}</p><div className="place-footer"><span>Default radius</span><strong>{place.radius}m</strong></div><div className="place-actions"><button className="text-button" onClick={() => startEdit(place)}>Edit</button><button className="text-button danger-text" onClick={() => deletePlace(place.id)}>Delete</button></div></article>)}</div> : <EmptyState title="No places saved" text="Add a place to keep your errands organized." />}<p className="prototype-disclaimer">Prototype only. No maps, GPS, or browser location APIs are active.</p></>
}

function SearchPage() {
  const [tab, setTab] = useState('search')
  const [query, setQuery] = useState('university work')
  const [question, setQuestion] = useState('What academic deadlines do I have?')
  const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const results = mockSearchResults.filter((result) => searchTerms.length === 0 || searchTerms.some((term) => [result.title, result.excerpt, result.domain, ...(result.keywords || [])].join(' ').toLowerCase().includes(term)))
  return <><PageHeader eyebrow="Find the thread" title="Search" description="Explore your notes by meaning, not just by keywords." /><div className="tabs"><button className={tab === 'search' ? 'tab active' : 'tab'} onClick={() => setTab('search')}>Search notes</button><button className={tab === 'ask' ? 'tab active' : 'tab'} onClick={() => setTab('ask')}>Ask my notes</button></div>{tab === 'search' ? <div className="search-panel"><form className="search-bar" onSubmit={(event) => event.preventDefault()}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your notes..." aria-label="Search your notes" /><button className="button button-primary">Search</button></form>{results.length ? <div className="search-results"><span className="eyebrow">Mock semantic results</span>{results.map((result) => <article className="search-result" key={result.id}><div><Pill>{result.domain}</Pill><h3>{result.title}</h3><p>{result.excerpt}</p></div><span>Prototype</span></article>)}</div> : <EmptyState title="No search results" text="Try another phrase, such as “university work”." />}</div> : <div className="ask-panel"><form onSubmit={(event) => event.preventDefault()}><label htmlFor="ask-question">Ask a question about your notes</label><div className="ask-input"><textarea id="ask-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows="3" /><button className="button button-primary">Ask <span>↗</span></button></div></form><div className="answer-card"><div className="answer-label"><span className="sparkle">✦</span><span>Mock answer · prototype</span></div><p>{mockAskResponse.answer}</p><div className="source-list"><span className="eyebrow">Source notes</span>{mockAskResponse.sources.map((source) => <span className="source" key={source}>↗ {source}</span>)}</div></div></div>}</>
}

function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const save = (event) => { event.preventDefault(); setSaved(true); window.setTimeout(() => setSaved(false), 1800) }
  return <><PageHeader eyebrow="Make it yours" title="Settings" description="Prototype preferences for how Rememberly should feel." /><AiProviderCard /><form className="settings-form" onSubmit={save}><section className="settings-section"><div><h2>Preferences</h2><p>These settings are local prototype values for now.</p></div><label className="setting-row"><span><strong>Daily briefing</strong><small>Receive a calm summary of what matters.</small></span><input type="checkbox" defaultChecked /></label><label className="setting-row"><span><strong>Default currency</strong><small>Used when displaying expenses.</small></span><select defaultValue="BDT"><option value="BDT">BDT · ৳</option><option value="USD">USD · $</option></select></label><label className="setting-row"><span><strong>Timezone</strong><small>Asia/Dhaka</small></span><select defaultValue="Asia/Dhaka"><option>Asia/Dhaka</option><option>UTC</option></select></label><label className="setting-row"><span><strong>Location Reminder Mode</strong><small>Requires browser location in a later part.</small></span><span className="off-badge">OFF</span></label></section><div className="settings-footer"><span className={saved ? 'save-message visible' : 'save-message'}>{saved ? 'Preferences saved locally' : 'Prototype settings'}</span><button className="button button-primary">Save preferences</button></div></form></>
}

function LoginPage() {
  const { login, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => { event.preventDefault(); if (!identity.trim() || !password) { setError('Enter your email and password to continue.'); return } setSubmitting(true); try { await login(identity, password); navigate('/app') } catch (requestError) { setError(requestError.message) } finally { setSubmitting(false) } }
  return <AuthLayout title="Welcome back" description="Pick up where you left off."><GoogleSignInButton /><form className="auth-form" onSubmit={submit}><label>Email or username<input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="maya@example.com" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /></label><Link className="text-link auth-help" to="/forgot-password">Forgot password?</Link>{error && <p className="form-error">{error}</p>}<button className="button button-primary button-wide" disabled={submitting || authLoading}>{submitting ? 'Logging in…' : authLoading ? 'Checking session…' : 'Log in'} <span>↗</span></button></form><p className="auth-switch">New here? <Link to="/register">Create an account</Link></p></AuthLayout>
}

function RegisterPage() {
  const { register, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => { event.preventDefault(); setMessage(''); if (!form.name.trim() || !form.email.trim() || form.password.length < 8 || form.password !== form.confirm) { setError('Use a name, email, matching passwords, and at least 8 password characters.'); return } setSubmitting(true); try { const user = await register({ name: form.name, email: form.email, password: form.password, password_confirm: form.confirm }); if (user) navigate('/app'); else { setError(''); setMessage('Account created. Check your email to confirm the account, then log in.') } } catch (requestError) { setError(requestError.message) } finally { setSubmitting(false) } }
  return <AuthLayout title="Make space for more" description="A gentle home for the things you want to remember."><GoogleSignInButton /><form className="auth-form" onSubmit={submit}><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Maya Rahman" /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="maya@example.com" /></label><label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" /></label><label>Confirm password<input type="password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} placeholder="Repeat your password" /></label>{message && <p className="form-success">{message}</p>}{error && <p className="form-error">{error}</p>}<button className="button button-primary button-wide" disabled={submitting || authLoading}>{submitting ? 'Creating account…' : authLoading ? 'Checking session…' : 'Create account'} <span>↗</span></button></form><p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p></AuthLayout>
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submit = async (event) => { event.preventDefault(); try { const data = await requestPasswordReset(email); setMessage(data.detail); setError('') } catch (requestError) { setError(requestError.message) } }
  return <AuthLayout title="Reset your password" description="Enter your account email. The response stays private even if the address is unknown."><form className="auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{message && <p className="form-success">{message}</p>}{error && <p className="form-error">{error}</p>}<button className="button button-primary button-wide">Send reset link</button></form><p className="auth-switch"><Link to="/login">Back to login</Link></p></AuthLayout>
}

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const submit = async (event) => { event.preventDefault(); if (password.length < 8 || password !== confirm) { setError('Use matching passwords with at least 8 characters.'); return } try { await confirmPasswordReset({ password }); navigate('/login', { replace: true }) } catch (requestError) { setError(requestError.message) } }
  return <AuthLayout title="Choose a new password" description="Use a strong password you do not reuse elsewhere."><form className="auth-form" onSubmit={submit}><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirm new password<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary button-wide">Reset password</button></form></AuthLayout>
}

function AuthCallbackPage() {
  const navigate = useNavigate()
  const { loading, isAuthenticated } = useAuth()
  useEffect(() => {
    if (!loading) navigate(isAuthenticated ? '/app' : '/login', { replace: true })
  }, [loading, isAuthenticated, navigate])
  return <div className="route-loading">Completing sign-in…</div>
}

function ProtectedPage({ children }) {
  const { isAuthenticated, loading, currentUser } = useAuth()
  if (loading) return <div className="route-loading">Checking your session…</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <AppLayout key={currentUser.id}>{children}</AppLayout>
}

function AuthLayout({ title, description, children }) {
  return <div className="auth-shell"><div className="auth-aside"><Link className="brand" to="/login"><span className="brand-mark">R</span><span>rememberly</span></Link><div className="auth-quote"><span>“</span><p>A place for the thoughts that make up your life.</p><small>Capture first. Organize automatically.</small></div><div className="auth-art"><span>✦</span><span>○</span><span>◷</span></div></div><main className="auth-main"><div className="auth-box"><span className="eyebrow">Your personal context layer</span><h1>{title}</h1><p className="auth-description">{description}</p>{children}</div></main></div>
}

function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={<LoginPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/auth/callback" element={<AuthCallbackPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/app" element={<ProtectedPage><DashboardPage /></ProtectedPage>} /><Route path="/app/notes" element={<ProtectedPage><NotesPage /></ProtectedPage>} /><Route path="/app/notes/new" element={<ProtectedPage><NewNotePage /></ProtectedPage>} /><Route path="/app/notes/:id" element={<ProtectedPage><NoteDetailPage /></ProtectedPage>} /><Route path="/app/tasks" element={<ProtectedPage><TasksPage /></ProtectedPage>} /><Route path="/app/events" element={<ProtectedPage><EventsPage /></ProtectedPage>} /><Route path="/app/shopping" element={<ProtectedPage><ShoppingPage /></ProtectedPage>} /><Route path="/app/expenses" element={<ProtectedPage><ExpensesPage /></ProtectedPage>} /><Route path="/app/places" element={<ProtectedPage><PlacesPage /></ProtectedPage>} /><Route path="/app/search" element={<ProtectedPage><SearchPage /></ProtectedPage>} /><Route path="/app/settings" element={<ProtectedPage><SettingsPage /></ProtectedPage>} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes></BrowserRouter>
}

export default App
