import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAppState } from './context/AppStateContext'
import { useAuth } from './context/AuthContext'
import { useNotes } from './context/NotesContext'
import { confirmPasswordReset, requestPasswordReset } from './api/authApi'
import { apiRequest } from './api/http'
import { LogoutIcon, MenuIcon, NavIcon, PlacesIcon, SparkleIcon } from './components/icons'
import AIReviewPanel from './features/notes/AIReviewPanel'
import { EventsPage, ExpensesPage, ShoppingPage, TasksPage } from './features/items/ItemPages'
import AiProviderCard from './features/notes/AiProviderCard'
import { clearSessionGroqKey, useAiKey } from './context/AiKeyContext'
import { AdminDashboardPage, AdminLoginPage, AdminProtected } from './features/admin/AdminPages'
import GoogleSignInButton from './components/GoogleSignInButton'
import TransactionsPage from './features/transactions/TransactionsPage'
import OnboardingPage from './features/onboarding/OnboardingPage'
import SearchFeaturePage from './features/search/SearchPage'
import ProcessButtons from './features/processing/ProcessButtons'
import { backlogNotes } from './api/processApi'

const navItems = [
  ['Dashboard', '/app'], ['Notes', '/app/notes'], ['Tasks', '/app/tasks'],
  ['Events', '/app/events'], ['Shopping', '/app/shopping'], ['Transactions', '/app/transactions'],
  ['Places', '/app/places'], ['Search', '/app/search'], ['Settings', '/app/settings']
]

function Pill({ children, tone = 'neutral' }) { return <span className={`pill pill-${tone.toLowerCase()}`}>{children}</span> }

function EmptyState({ title, text }) {
  return <div className="empty-state"><div className="empty-icon"><SparkleIcon /></div><h3>{title}</h3><p>{text}</p></div>
}

function PageHeader({ eyebrow, title, description, action }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>
}

function Sidebar({ onLogout, open, onToggle }) {
  return <aside className={`sidebar${open ? ' open' : ' closed'}`}>
    <div className="sidebar-top"><button className="menu-button" onClick={onToggle} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}><MenuIcon /></button></div>
    <div className="sidebar-label">Your space</div>
    <nav className="sidebar-nav" aria-label="Your space">{navItems.map(([label, path]) => <NavLink key={path} to={path} end={path === '/app'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><span className="nav-icon" aria-hidden="true"><NavIcon label={label} /></span><span className="nav-label">{label}</span></NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="prototype-note"><span className="status-dot" aria-hidden="true" /> <span className="fold-text">Prototype data</span></div><button className="logout-button" onClick={onLogout}><span className="logout-text">Log out</span> <LogoutIcon /></button></div>
  </aside>
}

function MobileNav() {
  return <nav className="mobile-nav">{navItems.slice(0, 5).map(([label, path]) => <NavLink key={path} to={path} end={path === '/app'} className={({ isActive }) => isActive ? 'mobile-link active' : 'mobile-link'}><NavIcon label={label} size={21} /><small>{label}</small></NavLink>)}</nav>
}

function AiNotices() {
  const { groqApiKey, trialActive } = useAiKey()
  const { notes, refresh } = useNotes()
  const [setupDismissed, setSetupDismissed] = useState(false)
  const configured = Boolean(groqApiKey || trialActive)
  if (!configured) {
    if (setupDismissed) return null
    return <div className="notice-banner notice-setup" role="status"><span className="notice-icon"><SparkleIcon /></span><div><strong>AI organization is off.</strong><span> Add a Groq key or turn on the free trial in Settings to process notes.</span></div><Link className="button button-primary" to="/app/settings">Open Settings</Link><button className="text-button" onClick={() => setSetupDismissed(true)}>Dismiss</button></div>
  }
  const backlog = backlogNotes(notes)
  if (!backlog.length) return null
  return <div className="notice-banner" role="status"><span className="notice-icon"><SparkleIcon /></span><div><strong>{backlog.length} note{backlog.length === 1 ? '' : 's'} need{backlog.length === 1 ? 's' : ''} processing.</strong><span> Draft them all at once, or verify them straight through.</span></div><ProcessButtons compact backlogCount={backlog.length} onDone={refresh} /></div>
}

function AppLayout({ children }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const handleLogout = async () => { try { await logout() } finally { clearSessionGroqKey(); navigate('/login') } }
  return <div className="app-shell">
    <Sidebar open={navOpen} onToggle={() => setNavOpen(!navOpen)} onLogout={handleLogout} />
    <main className="main-content"><div className="topbar"><Link className="brand" to="/app"><span className="brand-mark">R</span><span>rememberly</span></Link></div><div className="mobile-topbar"><Link className="brand" to="/app"><span className="brand-mark">R</span><span>rememberly</span></Link><button className="menu-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu"><MenuIcon /></button></div>{mobileOpen && <div className="mobile-menu">{navItems.map(([label, path]) => <NavLink key={path} to={path} onClick={() => setMobileOpen(false)} className="mobile-menu-link">{label}</NavLink>)}<button onClick={handleLogout}>Log out</button></div>}<AiNotices /><div className="content-wrap" key={location.pathname}>{children}</div></main>
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
    <div className="capture-heading"><span className="capture-icon"><SparkleIcon /></span><div><h2>Quick capture</h2><p>Get it out of your head. We&apos;ll help organize it.</p></div></div>
    <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="What do you want to remember?" rows={compact ? 3 : 4} aria-label="What do you want to remember?" />
    {error && <p className="form-error">{error}</p>}<div className="capture-footer"><span className={saved ? 'save-message visible' : 'save-message'}>{saved ? 'Saved as an unprocessed note' : 'Try: “I need eggs from Agora.”'}</span><div className="capture-actions">{savedNoteId && <Link className="button button-ghost" to={`/app/notes/${savedNoteId}`}>Review saved note</Link>}<button className="button button-ghost" type="button" onClick={() => navigate('/app/notes/new')}>Open full editor</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save note'} <span>↗</span></button></div></div>
  </form>
}

function DashboardPage() {
  const { dashboardItems, tasks } = useAppState()
  const { currentUser } = useAuth()
  const { notes, refresh } = useNotes()
  const backlog = backlogNotes(notes)
  return <><PageHeader eyebrow="Monday, September 21" title={`Good morning, ${currentUser?.name || 'there'}`} description="A calm place for everything you want to remember." /><QuickCapture /><section className="section-block queue-panel" aria-label="Processing queue"><div className="section-heading"><div><span className="eyebrow">Capture to confirmed</span><h2>Processing queue</h2></div>{backlog.length > 0 && <span className="pill pill-medium">{backlog.length} waiting</span>}</div>{backlog.length ? <><ProcessButtons backlogCount={backlog.length} onDone={refresh} /><div className="queue-list">{backlog.map((note) => <article className="queue-row" key={note.id}><div><Link to={`/app/notes/${note.id}`} className="queue-title">{note.originalText.slice(0, 90) || 'Untitled note'}</Link><span className="queue-meta">{note.processingStatus === 'FAILED' ? 'Needs a retry' : 'Not processed yet'} · open to organize manually</span></div><Pill tone={note.processingStatus === 'FAILED' ? 'high' : 'medium'}>{note.processingStatus}</Pill></article>)}</div></> : <p className="queue-empty">All caught up — every note is processed.</p>}</section><section className="section-block"><div className="section-heading"><div><span className="eyebrow">Stay in the loop</span><h2>What matters now</h2></div><Link to="/app/tasks" className="text-link">See all tasks <span>→</span></Link></div><div className="matter-grid">{dashboardItems.map((item) => <article className="matter-card" key={item.id}><div className="matter-top"><Pill tone={item.priority}>{item.type}</Pill><span className={`priority priority-${item.priority.toLowerCase()}`} /> </div><h3>{item.title}</h3><p>{item.reason}</p><span className="card-domain">{item.domain}</span></article>)}</div></section><section className="dashboard-grid"><div className="summary-card"><div className="section-heading"><div><span className="eyebrow">At a glance</span><h2>Today&apos;s rhythm</h2></div><span className="date-chip">Sep 21</span></div><div className="summary-list"><div><span className="summary-number">{tasks.filter((task) => task.status !== 'DONE').length}</span><span>Tasks</span></div><div><span className="summary-number">1</span><span>Event</span></div><div><span className="summary-number">৳250</span><span>Expenses</span></div></div></div><div className="briefing-card"><span className="eyebrow">Daily briefing · prototype</span><h2>A little room to breathe</h2><p>You have a focused day ahead. Your EM quiz is coming up, and there are three small tasks waiting for you.</p><Link to="/app/search" className="button button-light">Ask your notes <span>→</span></Link></div></section></>
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
  return <><PageHeader eyebrow="Capture first" title="New note" description="Write naturally. No categories or forms to fill out first." /><div className="editor-layout"><form className="editor-card" onSubmit={save}><label htmlFor="note-editor">Your thought</label><textarea id="note-editor" value={text} onChange={(event) => setText(event.target.value)} placeholder="I have an EM quiz on September 23..." rows="12" autoFocus />{error && <p className="form-error">{error}</p>}<div className="editor-footer"><span>{text.length} characters</span><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save note'} <span>↗</span></button></div></form><div className="editor-tip"><span className="tip-icon"><SparkleIcon /></span><h3>Captured now, organized later</h3><p>Save first, then analyze with AI or organize manually. Review and correct suggested items before confirming them.</p><div className="example-note">“Tomorrow class at 10, buy eggs afterwards, and spent ৳250 on books.”</div></div></div></>
}

function NoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notes, loading, loadNote, updateNote, deleteNote } = useNotes()
  const note = notes.find((item) => String(item.id) === String(id))
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [missing, setMissing] = useState(false)
  const [detailLoading, setDetailLoading] = useState(true)
  const [reloadTick, setReloadTick] = useState(0)
  const [pendingAction, setPendingAction] = useState('')
  useEffect(() => { if (note) setText(note.originalText) }, [note])
  useEffect(() => {
    let active = true
    setDetailLoading(true)
    setDetailError('')
    setMissing(false)
    loadNote(id).catch((requestError) => {
      if (!active) return
      if (requestError?.status === 404) setMissing(true)
      else setDetailError(requestError.message || 'This note could not be loaded.')
    }).finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [id, reloadTick])
  if (loading || detailLoading) return <div className="loading-state">Loading note…</div>
  if (missing || (!detailError && !note)) return <EmptyState title="Note not found" text="This note may have been deleted or is no longer available." />
  if (detailError) return <div className="empty-state"><div className="empty-icon"><SparkleIcon /></div><h3>Couldn&apos;t load this note</h3><p>{detailError}</p><button className="button button-primary" onClick={() => setReloadTick((value) => value + 1)}>Retry</button></div>
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
  return <><PageHeader eyebrow="Context, later" title="Places" description="Saved places for a future, smarter reminder experience." action={<button className="button button-primary" onClick={() => { if (formOpen) closeForm(); else { setEditingId(null); setFormOpen(true) } }}>{formOpen ? 'Cancel' : '+ Add place'}</button>} />{formOpen && <form className="inline-form" onSubmit={save}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Place name" aria-label="Place name" required /><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Mock address" aria-label="Mock address" /><button className="button button-primary">{editingId ? 'Save changes' : 'Save place'}</button></form>}{places.length ? <div className="places-grid">{places.map((place) => <article className="place-card" key={place.id}><div className="place-card-top"><span className="place-icon"><PlacesIcon /></span><button className="icon-button" aria-label={`Delete ${place.name}`} onClick={() => deletePlace(place.id)}>×</button></div><h2>{place.name}</h2><p>{place.address}</p><div className="place-footer"><span>Default radius</span><strong>{place.radius}m</strong></div><div className="place-actions"><button className="text-button" onClick={() => startEdit(place)}>Edit</button><button className="text-button danger-text" onClick={() => deletePlace(place.id)}>Delete</button></div></article>)}</div> : <EmptyState title="No places saved" text="Add a place to keep your errands organized." />}<p className="prototype-disclaimer">Prototype only. No maps, GPS, or browser location APIs are active.</p></>
}


const weekStartOptions = [
  ['0', 'Sunday'], ['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'],
  ['4', 'Thursday'], ['5', 'Friday'], ['6', 'Saturday'],
]

function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [error, setError] = useState('')
  const [prefs, setPrefs] = useState(null)
  const [profile, setProfile] = useState(null)
  const applySettings = (data) => {
    setPrefs(data.preferences)
    setProfile({
      display_name: data.user.display_name || data.user.name || '',
      default_currency: data.user.default_currency || 'BDT',
      timezone: data.user.timezone || 'Asia/Dhaka',
    })
  }
  useEffect(() => {
    let active = true
    apiRequest('/auth/settings/', {}, false)
      .then((data) => { if (!active) return; applySettings(data); setError('') })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const setPref = (field, value) => { setPrefs((current) => ({ ...current, [field]: value })); setSavedMessage('') }
  const setProfileField = (field, value) => { setProfile((current) => ({ ...current, [field]: value })); setSavedMessage('') }
  const save = async (event) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const [preferenceData, profileData] = await Promise.all([
        apiRequest('/auth/preferences/', { method: 'PATCH', body: JSON.stringify(prefs) }, false),
        apiRequest('/auth/me/', { method: 'PATCH', body: JSON.stringify(profile) }, false),
      ])
      applySettings({ user: profileData, preferences: preferenceData })
      setSavedMessage('Preferences saved')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }
  const resetDefaults = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const data = await apiRequest('/auth/preferences/reset/', { method: 'POST', body: '{}' }, false)
      applySettings(data)
      setSavedMessage('Preferences reset to defaults')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }
  return <><PageHeader eyebrow="Make it yours" title="Settings" description="Your notification preferences and account defaults." /><AiProviderCard />{loading ? <div className="loading-state">Loading your settings…</div> : error && !prefs ? <div className="form-error">{error}</div> : <form className="settings-form" onSubmit={save}><section className="settings-section"><div><h2>Preferences</h2><p>Saved to your account and used across devices.</p></div><label className="setting-row"><span><strong>Display name</strong><small>Shown in greetings across the app.</small></span><input value={profile.display_name} onChange={(event) => setProfileField('display_name', event.target.value)} placeholder="Maya Rahman" aria-label="Display name" maxLength={120} /></label><label className="setting-row"><span><strong>Daily briefing</strong><small>Receive a calm summary of what matters.</small></span><input type="checkbox" checked={prefs.daily_briefing_enabled} onChange={(event) => setPref('daily_briefing_enabled', event.target.checked)} aria-label="Daily briefing" /></label><label className="setting-row"><span><strong>Notifications</strong><small>General account notifications.</small></span><input type="checkbox" checked={prefs.notification_enabled} onChange={(event) => setPref('notification_enabled', event.target.checked)} aria-label="Notifications" /></label><label className="setting-row"><span><strong>Time reminders</strong><small>Remind me about timed items.</small></span><input type="checkbox" checked={prefs.time_reminders_enabled} onChange={(event) => setPref('time_reminders_enabled', event.target.checked)} aria-label="Time reminders" /></label><label className="setting-row"><span><strong>Location reminders</strong><small>Requires browser location in a later part.</small></span><input type="checkbox" checked={prefs.location_reminders_enabled} onChange={(event) => setPref('location_reminders_enabled', event.target.checked)} aria-label="Location reminders" /></label><label className="setting-row"><span><strong>Week starts on</strong><small>First day of your week.</small></span><select value={String(prefs.week_starts_on)} onChange={(event) => setPref('week_starts_on', Number(event.target.value))} aria-label="Week starts on">{weekStartOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="setting-row"><span><strong>Default currency</strong><small>Used when displaying expenses.</small></span><select value={profile.default_currency} onChange={(event) => setProfileField('default_currency', event.target.value)} aria-label="Default currency"><option value="BDT">BDT · ৳</option><option value="USD">USD · $</option><option value="EUR">EUR · €</option><option value="INR">INR · ₹</option><option value="GBP">GBP · £</option></select></label><label className="setting-row"><span><strong>Timezone</strong><small>Used for dates across the app.</small></span><select value={profile.timezone} onChange={(event) => setProfileField('timezone', event.target.value)} aria-label="Timezone"><option>Asia/Dhaka</option><option>UTC</option></select></label></section>{error && <p className="form-error">{error}</p>}<div className="settings-footer"><span className={savedMessage ? 'save-message visible' : 'save-message'}>{savedMessage || 'Unsaved changes'}</span><button className="button button-ghost" type="button" onClick={resetDefaults} disabled={saving}>{saving ? 'Working…' : 'Reset to defaults'}</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save preferences'}</button></div></form>}</>
}

function LoginPage() {
  const { login, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => { event.preventDefault(); if (!identity.trim() || !password) { setError('Enter your email and password to continue.'); return } setSubmitting(true); try { await login(identity, password); navigate('/app') } catch (requestError) { setError(requestError.message) } finally { setSubmitting(false) } }
  return <AuthLayout title="Welcome back" description="Pick up where you left off."><GoogleSignInButton /><form className="auth-form" onSubmit={submit}><label>Email or username<input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="maya@example.com" /></label><label>Password<div className="password-row"><input aria-label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /><button type="button" className="text-button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button></div></label><Link className="text-link auth-help" to="/forgot-password">Forgot password?</Link>{error && <p className="form-error">{error}</p>}<button className="button button-primary button-wide" disabled={submitting || authLoading}>{submitting ? 'Logging in…' : authLoading ? 'Checking session…' : 'Log in'} <span>↗</span></button></form><p className="auth-switch">New here? <Link to="/register">Create an account</Link></p></AuthLayout>
}

function RegisterPage() {
  const { register, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => { event.preventDefault(); setMessage(''); if (!form.name.trim() || !form.email.trim() || form.password.length < 8 || form.password !== form.confirm) { setError('Use a name, email, matching passwords, and at least 8 password characters.'); return } setSubmitting(true); try { const user = await register({ name: form.name, email: form.email, password: form.password, password_confirm: form.confirm }); if (user) navigate('/app'); else { setError(''); setMessage('Account created. Check your email to confirm the account, then log in.') } } catch (requestError) { setError(requestError.message) } finally { setSubmitting(false) } }
  return <AuthLayout title="Make space for more" description="A gentle home for the things you want to remember."><GoogleSignInButton /><form className="auth-form" onSubmit={submit}><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Maya Rahman" /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="maya@example.com" /></label><label>Password<div className="password-row"><input aria-label="Password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" /><button type="button" className="text-button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button></div></label><label>Confirm password<input type={showPassword ? 'text' : 'password'} value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} placeholder="Repeat your password" /></label>{message && <p className="form-success">{message}</p>}{error && <p className="form-error">{error}</p>}<button className="button button-primary button-wide" disabled={submitting || authLoading}>{submitting ? 'Creating account…' : authLoading ? 'Checking session…' : 'Create account'} <span>↗</span></button></form><p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p></AuthLayout>
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
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => { event.preventDefault(); if (password.length < 8 || password !== confirm) { setError('Use matching passwords with at least 8 characters.'); return } try { await confirmPasswordReset({ password }); navigate('/login', { replace: true }) } catch (requestError) { setError(requestError.message) } }
  return <AuthLayout title="Choose a new password" description="Use a strong password you do not reuse elsewhere."><form className="auth-form" onSubmit={submit}><label>New password<div className="password-row"><input aria-label="New password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="text-button" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button></div></label><label>Confirm new password<input type={showPassword ? 'text' : 'password'} value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary button-wide">Reset password</button></form></AuthLayout>
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
  return <div className="auth-shell"><div className="auth-aside"><Link className="brand" to="/login"><span className="brand-mark">R</span><span>rememberly</span></Link><div className="auth-quote"><span>“</span><p>A place for the thoughts that make up your life.</p><small>Capture first. Organize automatically.</small></div><div className="auth-art" aria-hidden="true"><span /><span /><span /></div></div><main className="auth-main"><div className="auth-box"><span className="eyebrow">Your personal context layer</span><h1>{title}</h1><p className="auth-description">{description}</p>{children}</div></main></div>
}

 function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={<LoginPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/auth/callback" element={<AuthCallbackPage />} /><Route path="/forgot-password" element={<ForgotPasswordPage />} /><Route path="/reset-password" element={<ResetPasswordPage />} /><Route path="/admin/login" element={<AdminLoginPage />} /><Route path="/admin/*" element={<AdminProtected><AdminDashboardPage /></AdminProtected>} /><Route path="/app" element={<ProtectedPage><DashboardPage /></ProtectedPage>} /><Route path="/app/notes" element={<ProtectedPage><NotesPage /></ProtectedPage>} /><Route path="/app/notes/new" element={<ProtectedPage><NewNotePage /></ProtectedPage>} /><Route path="/app/notes/:id" element={<ProtectedPage><NoteDetailPage /></ProtectedPage>} /><Route path="/app/tasks" element={<ProtectedPage><TasksPage /></ProtectedPage>} /><Route path="/app/events" element={<ProtectedPage><EventsPage /></ProtectedPage>} /><Route path="/app/shopping" element={<ProtectedPage><ShoppingPage /></ProtectedPage>} /><Route path="/app/expenses" element={<ProtectedPage><ExpensesPage /></ProtectedPage>} /><Route path="/app/transactions" element={<ProtectedPage><TransactionsPage /></ProtectedPage>} /><Route path="/app/places" element={<ProtectedPage><PlacesPage /></ProtectedPage>} /><Route path="/app/search" element={<ProtectedPage><SearchFeaturePage /></ProtectedPage>} /><Route path="/app/onboarding" element={<ProtectedPage><OnboardingPage /></ProtectedPage>} /><Route path="/app/settings" element={<ProtectedPage><SettingsPage /></ProtectedPage>} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes></BrowserRouter>
}

export default App
