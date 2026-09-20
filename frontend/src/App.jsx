import { useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAppState } from './context/AppStateContext'
import { mockAskResponse, mockSearchResults } from './data/mockData'

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

function Sidebar({ onLogout }) {
  return <aside className="sidebar">
    <Link className="brand" to="/app"><span className="brand-mark">R</span><span>rememberly</span></Link>
    <div className="sidebar-label">Your space</div>
    <nav className="sidebar-nav">{navItems.map(([label, path, icon]) => <NavLink key={path} to={path} end={path === '/app'} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><span className="nav-icon">{icon}</span>{label}</NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="prototype-note"><span className="status-dot" /> Prototype data</div><button className="logout-button" onClick={onLogout}>Log out <span>↗</span></button></div>
  </aside>
}

function MobileNav() {
  return <nav className="mobile-nav">{navItems.slice(0, 5).map(([label, path, icon]) => <NavLink key={path} to={path} end={path === '/app'} className={({ isActive }) => isActive ? 'mobile-link active' : 'mobile-link'}><span>{icon}</span><small>{label}</small></NavLink>)}</nav>
}

function AppLayout({ children }) {
  const { logout } = useAppState()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const handleLogout = () => { logout(); navigate('/login') }
  return <div className="app-shell">
    <Sidebar onLogout={handleLogout} />
    <main className="main-content"><div className="mobile-topbar"><Link className="brand" to="/app"><span className="brand-mark">R</span><span>rememberly</span></Link><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">☰</button></div>{menuOpen && <div className="mobile-menu">{navItems.map(([label, path]) => <NavLink key={path} to={path} onClick={() => setMenuOpen(false)} className="mobile-menu-link">{label}</NavLink>)}<button onClick={handleLogout}>Log out</button></div>}<div className="content-wrap" key={location.pathname}>{children}</div></main>
    <MobileNav />
  </div>
}

function QuickCapture({ compact = false }) {
  const { addNote } = useAppState()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const save = (event) => {
    event.preventDefault()
    if (!text.trim()) return
    addNote(text)
    setText('')
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2400)
  }
  return <form className={`capture-card ${compact ? 'capture-compact' : ''}`} onSubmit={save}>
    <div className="capture-heading"><span className="capture-icon">✦</span><div><h2>Quick capture</h2><p>Get it out of your head. We&apos;ll help organize it.</p></div></div>
    <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="What do you want to remember?" rows={compact ? 3 : 4} aria-label="What do you want to remember?" />
    <div className="capture-footer"><span className={saved ? 'save-message visible' : 'save-message'}>{saved ? 'Saved to your notes' : 'Try: “I need eggs from Agora.”'}</span><div className="capture-actions"><button className="button button-ghost" type="button" onClick={() => navigate('/app/notes/new')}>Open full editor</button><button className="button button-primary" type="submit">Save note <span>↗</span></button></div></div>
  </form>
}

function DashboardPage() {
  const { dashboardItems, tasks } = useAppState()
  return <><PageHeader eyebrow="Monday, September 21" title="Good morning, Maya" description="A calm place for everything you want to remember." /><QuickCapture /><section className="section-block"><div className="section-heading"><div><span className="eyebrow">Stay in the loop</span><h2>What matters now</h2></div><Link to="/app/tasks" className="text-link">See all tasks <span>→</span></Link></div><div className="matter-grid">{dashboardItems.map((item) => <article className="matter-card" key={item.id}><div className="matter-top"><Pill tone={item.priority}>{item.type}</Pill><span className={`priority priority-${item.priority.toLowerCase()}`} /> </div><h3>{item.title}</h3><p>{item.reason}</p><span className="card-domain">{item.domain}</span></article>)}</div></section><section className="dashboard-grid"><div className="summary-card"><div className="section-heading"><div><span className="eyebrow">At a glance</span><h2>Today&apos;s rhythm</h2></div><span className="date-chip">Sep 21</span></div><div className="summary-list"><div><span className="summary-number">{tasks.filter((task) => task.status !== 'DONE').length}</span><span>Tasks</span></div><div><span className="summary-number">1</span><span>Event</span></div><div><span className="summary-number">৳250</span><span>Expenses</span></div></div></div><div className="briefing-card"><span className="eyebrow">Daily briefing · prototype</span><h2>A little room to breathe</h2><p>You have a focused day ahead. Your EM quiz is coming up, and there are three small tasks waiting for you.</p><Link to="/app/search" className="button button-light">Ask your notes <span>→</span></Link></div></section></>
}

function NoteCard({ note, onDelete }) {
  const { noteItems } = useAppState()
  const items = noteItems.filter((item) => note.itemIds?.includes(item.id))
  return <article className="note-card"><div className="note-card-top"><Pill tone="success">{note.processingStatus}</Pill><span className="note-date">{new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div><Link to={`/app/notes/${note.id}`} className="note-title">{note.originalText}</Link><div className="note-card-items">{items.slice(0, 3).map((item) => <span key={item.id}>{item.type === 'TASK' ? '✓' : item.type === 'EVENT' ? '◷' : '৳'} {item.title}</span>)}</div><div className="note-card-bottom"><div className="domain-list">{note.domains.map((domain) => <Pill key={domain}>{domain}</Pill>)}</div><div className="card-actions"><Link to={`/app/notes/${note.id}`} aria-label={`View ${note.originalText}`}>View</Link><button onClick={() => onDelete(note.id)}>Delete</button></div></div></article>
}

function NotesPage() {
  const { notes, deleteNote } = useAppState()
  return <><PageHeader eyebrow="Your memory" title="Notes" description={`${notes.length} thoughts captured and organized.`} action={<Link className="button button-primary" to="/app/notes/new">+ New note</Link>} />{notes.length ? <div className="notes-list">{notes.map((note) => <NoteCard key={note.id} note={note} onDelete={deleteNote} />)}</div> : <EmptyState title="No notes yet" text="Start with a quick capture and give your thoughts somewhere to land." />}</>
}

function AIReviewPanel({ noteId, onEdit }) {
  const { noteItems } = useAppState()
  const items = noteItems.filter((item) => item.noteId === noteId)
  return <div className="review-panel"><div className="review-header"><div><span className="eyebrow">Mock AI result</span><h2>Here&apos;s what I found</h2></div><Pill tone="success">94% confidence</Pill></div><div className="review-items">{items.map((item) => <div className="review-item" key={item.id}><span className={`type-icon type-${item.type.toLowerCase()}`}>{item.type === 'TASK' ? '✓' : item.type === 'EVENT' ? '◷' : item.type === 'EXPENSE' ? '৳' : 'i'}</span><div><strong>{item.title}</strong><p>{item.type} · {item.domain}{item.amount ? ` · ৳${item.amount}` : ''}</p></div></div>)}</div><div className="review-actions"><button className="button button-primary" onClick={onEdit}>Looks correct</button><button className="button button-ghost" onClick={onEdit}>Edit result</button></div></div>
}

function NewNotePage() {
  const { addNote } = useAppState()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [savedId, setSavedId] = useState(null)
  const save = (event) => { event.preventDefault(); const id = addNote(text); if (id) setSavedId(id) }
  return <><PageHeader eyebrow="Capture first" title="New note" description="Write naturally. No categories or forms to fill out first." /><div className="editor-layout"><form className="editor-card" onSubmit={save}><label htmlFor="note-editor">Your thought</label><textarea id="note-editor" value={text} onChange={(event) => setText(event.target.value)} placeholder="I have an EM quiz on September 23..." rows="12" autoFocus /><div className="editor-footer"><span>{text.length} characters</span><button className="button button-primary" type="submit">Save note <span>↗</span></button></div></form>{savedId ? <AIReviewPanel noteId={savedId} onEdit={() => navigate(`/app/notes/${savedId}`)} /> : <div className="editor-tip"><span className="tip-icon">✦</span><h3>One thought, many possibilities</h3><p>After you save, this prototype will simulate how your note could become tasks, events, or expenses.</p><div className="example-note">“Tomorrow class at 10, buy eggs afterwards, and spent ৳250 on books.”</div></div>}</div></>
}

function NoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notes, noteItems, updateNote, deleteNote } = useAppState()
  const note = notes.find((item) => item.id === id)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note?.originalText || '')
  if (!note) return <EmptyState title="Note not found" text="This note may have been deleted or is no longer available." />
  const items = noteItems.filter((item) => note.itemIds?.includes(item.id))
  const save = () => { updateNote(note.id, text); setEditing(false) }
  return <><Link to="/app/notes" className="back-link">← Back to notes</Link><div className="detail-header"><div><span className="eyebrow">Note detail</span><h1>Captured thought</h1><p>{new Date(note.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><div className="header-actions"><button className="button button-ghost" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</button><button className="button button-danger" onClick={() => { deleteNote(note.id); navigate('/app/notes') }}>Delete</button></div></div><div className="detail-card"><div className="original-note"><span className="eyebrow">Original note</span>{editing ? <textarea value={text} onChange={(event) => setText(event.target.value)} rows="5" /> : <p>{note.originalText}</p>}{editing && <button className="button button-primary" onClick={save}>Save changes</button>}</div><div className="detail-meta"><Pill tone="success">{note.processingStatus}</Pill><span>{note.confidence}% confidence</span>{note.domains.map((domain) => <Pill key={domain}>{domain}</Pill>)}</div></div><section className="section-block detail-items"><div className="section-heading"><div><span className="eyebrow">Organized automatically · prototype</span><h2>{items.length} extracted items</h2></div></div><div className="extracted-grid">{items.map((item) => <article className="extracted-card" key={item.id}><span className={`type-icon type-${item.type.toLowerCase()}`}>{item.type === 'TASK' ? '✓' : item.type === 'EVENT' ? '◷' : '৳'}</span><Pill>{item.type}</Pill><h3>{item.title}</h3><p>{item.domain}{item.deadline ? ` · ${item.deadline}` : ''}{item.amount ? ` · ৳${item.amount}` : ''}</p></article>)}</div></section></>
}

function TasksPage() {
  const { tasks, toggleTask } = useAppState()
  return <><PageHeader eyebrow="Next actions" title="Tasks" description="Small steps that keep your days moving." /><div className="task-list">{tasks.map((task) => <article className={`task-row ${task.status === 'DONE' ? 'completed' : ''}`} key={task.id}><button className="check-button" onClick={() => toggleTask(task.id)} aria-label={`Mark ${task.title} ${task.status === 'DONE' ? 'incomplete' : 'complete'}`}>{task.status === 'DONE' ? '✓' : ''}</button><div className="task-main"><h3>{task.title}</h3><div><span>{task.deadline}</span>{task.place && <span>⌖ {task.place}</span>}{task.domains.map((domain) => <Pill key={domain}>{domain}</Pill>)}</div></div><Pill tone={task.importance}>{task.importance}</Pill></article>)}</div></>
}

function EventsPage() {
  const { events } = useAppState()
  return <><PageHeader eyebrow="Mark the moment" title="Events" description="Upcoming dates worth keeping in view." />{events.length ? <div className="event-list">{events.map((event) => <article className="event-card" key={event.id}><div className="event-date"><strong>{event.date.split(' ')[1]}</strong><span>{event.date.split(' ')[0]}</span></div><div><Pill>{event.domain}</Pill><h2>{event.title}</h2><p>{event.time}</p></div><span className="event-arrow">→</span></article>)}</div> : <EmptyState title="No upcoming events" text="Dates and deadlines will appear here when you capture them." />}</>
}

function ShoppingPage() {
  const { shoppingGroups } = useAppState()
  return <><PageHeader eyebrow="Errands made easier" title="Shopping" description="A simple view of what you need and where to find it." />{shoppingGroups.length ? <div className="shopping-grid">{shoppingGroups.map((group) => <article className="shopping-card" key={group.id}><div className="shopping-heading"><span className="place-icon">⌖</span><div><h2>{group.placeName}</h2><p>{group.items.length} items</p></div></div><ul>{group.items.map((item) => <li key={item}><span className="shopping-check" />{item}</li>)}</ul></article>)}</div> : <EmptyState title="No shopping items" text="Capture something like “I need eggs from Agora” to see it here." />}</>
}

function ExpensesPage() {
  const { expenses } = useAppState()
  const categoryTotals = { Shopping: 2300, Education: 1200, Transport: 900, Other: 450 }
  return <><PageHeader eyebrow="Your spending" title="Expenses" description="A clear, lightweight view of your recent spending." /><div className="expense-overview"><div className="total-card"><span className="eyebrow">September total</span><strong>৳4,850</strong><p>Mock prototype total</p></div><div className="category-card"><span className="eyebrow">By category</span>{Object.entries(categoryTotals).map(([category, amount]) => <div className="category-row" key={category}><span><i className={`category-dot dot-${category.toLowerCase()}`} />{category}</span><strong>৳{amount.toLocaleString()}</strong></div>)}</div></div><section className="section-block"><div className="section-heading"><div><span className="eyebrow">Most recent</span><h2>Recent expenses</h2></div></div>{expenses.length ? <div className="expense-list">{expenses.map((expense) => <article className="expense-row" key={expense.id}><div className="expense-symbol">৳</div><div><h3>{expense.title}</h3><p>{expense.quantity || expense.domain} · {expense.date}</p></div><strong>৳{expense.amount}</strong></article>)}</div> : <EmptyState title="No expenses recorded" text="Captured spending will appear here." />}</section></>
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
  return <><PageHeader eyebrow="Find the thread" title="Search" description="Explore your notes by meaning, not just by keywords." /><div className="tabs"><button className={tab === 'search' ? 'tab active' : 'tab'} onClick={() => setTab('search')}>Search notes</button><button className={tab === 'ask' ? 'tab active' : 'tab'} onClick={() => setTab('ask')}>Ask my notes</button></div>{tab === 'search' ? <div className="search-panel"><form className="search-bar" onSubmit={(event) => event.preventDefault()}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your notes..." aria-label="Search your notes" /><button className="button button-primary">Search</button></form>{results.length ? <div className="search-results"><span className="eyebrow">Mock semantic results</span>{results.map((result) => <Link to={`/app/notes/${result.noteId}`} className="search-result" key={result.id}><div><Pill>{result.domain}</Pill><h3>{result.title}</h3><p>{result.excerpt}</p></div><span>→</span></Link>)}</div> : <EmptyState title="No search results" text="Try another phrase, such as “university work”." />}</div> : <div className="ask-panel"><form onSubmit={(event) => event.preventDefault()}><label htmlFor="ask-question">Ask a question about your notes</label><div className="ask-input"><textarea id="ask-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows="3" /><button className="button button-primary">Ask <span>↗</span></button></div></form><div className="answer-card"><div className="answer-label"><span className="sparkle">✦</span><span>Mock answer · prototype</span></div><p>{mockAskResponse.answer}</p><div className="source-list"><span className="eyebrow">Source notes</span>{mockAskResponse.sources.map((source) => <span className="source" key={source}>↗ {source}</span>)}</div></div></div>}</>
}

function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const save = (event) => { event.preventDefault(); setSaved(true); window.setTimeout(() => setSaved(false), 1800) }
  return <><PageHeader eyebrow="Make it yours" title="Settings" description="Prototype preferences for how Rememberly should feel." /><form className="settings-form" onSubmit={save}><section className="settings-section"><div><h2>Preferences</h2><p>These settings are local prototype values for now.</p></div><label className="setting-row"><span><strong>Daily briefing</strong><small>Receive a calm summary of what matters.</small></span><input type="checkbox" defaultChecked /></label><label className="setting-row"><span><strong>Default currency</strong><small>Used when displaying expenses.</small></span><select defaultValue="BDT"><option value="BDT">BDT · ৳</option><option value="USD">USD · $</option></select></label><label className="setting-row"><span><strong>Timezone</strong><small>Asia/Dhaka</small></span><select defaultValue="Asia/Dhaka"><option>Asia/Dhaka</option><option>UTC</option></select></label><label className="setting-row"><span><strong>Location Reminder Mode</strong><small>Requires browser location in a later part.</small></span><span className="off-badge">OFF</span></label></section><div className="settings-footer"><span className={saved ? 'save-message visible' : 'save-message'}>{saved ? 'Preferences saved locally' : 'Prototype settings'}</span><button className="button button-primary">Save preferences</button></div></form></>
}

function LoginPage() {
  const { login } = useAppState()
  const navigate = useNavigate()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = (event) => { event.preventDefault(); if (!identity.trim() || !password) { setError('Enter your email and password to continue.'); return } login(identity); navigate('/app') }
  return <AuthLayout title="Welcome back" description="Pick up where you left off."><form className="auth-form" onSubmit={submit}><label>Email or username<input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="maya@example.com" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary button-wide">Log in <span>↗</span></button></form><p className="auth-switch">New here? <Link to="/register">Create an account</Link></p></AuthLayout>
}

function RegisterPage() {
  const { login } = useAppState()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const submit = (event) => { event.preventDefault(); if (!form.name || !form.email || form.password.length < 6 || form.password !== form.confirm) { setError('Use a name, email, matching passwords, and at least 6 password characters.'); return } login(form.email); navigate('/app') }
  return <AuthLayout title="Make space for more" description="A gentle home for the things you want to remember."><form className="auth-form" onSubmit={submit}><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Maya Rahman" /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="maya@example.com" /></label><label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 6 characters" /></label><label>Confirm password<input type="password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} placeholder="Repeat your password" /></label>{error && <p className="form-error">{error}</p>}<button className="button button-primary button-wide">Create account <span>↗</span></button></form><p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p></AuthLayout>
}

function AuthLayout({ title, description, children }) {
  return <div className="auth-shell"><div className="auth-aside"><Link className="brand" to="/login"><span className="brand-mark">R</span><span>rememberly</span></Link><div className="auth-quote"><span>“</span><p>A place for the thoughts that make up your life.</p><small>Capture first. Organize automatically.</small></div><div className="auth-art"><span>✦</span><span>○</span><span>◷</span></div></div><main className="auth-main"><div className="auth-box"><span className="eyebrow">Your personal context layer</span><h1>{title}</h1><p className="auth-description">{description}</p>{children}</div></main></div>
}

function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={<LoginPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/app" element={<AppLayout><DashboardPage /></AppLayout>} /><Route path="/app/notes" element={<AppLayout><NotesPage /></AppLayout>} /><Route path="/app/notes/new" element={<AppLayout><NewNotePage /></AppLayout>} /><Route path="/app/notes/:id" element={<AppLayout><NoteDetailPage /></AppLayout>} /><Route path="/app/tasks" element={<AppLayout><TasksPage /></AppLayout>} /><Route path="/app/events" element={<AppLayout><EventsPage /></AppLayout>} /><Route path="/app/shopping" element={<AppLayout><ShoppingPage /></AppLayout>} /><Route path="/app/expenses" element={<AppLayout><ExpensesPage /></AppLayout>} /><Route path="/app/places" element={<AppLayout><PlacesPage /></AppLayout>} /><Route path="/app/search" element={<AppLayout><SearchPage /></AppLayout>} /><Route path="/app/settings" element={<AppLayout><SettingsPage /></AppLayout>} /><Route path="*" element={<LoginPage />} /></Routes></BrowserRouter>
}

export default App
