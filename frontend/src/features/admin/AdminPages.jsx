import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  createAdmin, createTrialKey, deleteTrialKey, deleteUser, getAiSettings, listAdmins, listTrialKeys, listUsers,
  patchAdmin, patchAiSettings, patchTrialKey, patchUser,
} from '../../api/adminApi'
import { useAdmin } from '../../context/AdminContext'
import PasswordStrength from '../../components/PasswordStrength'

function ErrorText({ error }) {
  if (!error) return null
  return <p className="form-error">{error}</p>
}

export function AdminLoginPage() {
  const { login, loading } = useAdmin()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (!username.trim() || !password) { setError('Enter your admin username and password.'); return }
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/admin')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }
  return <div className="auth-shell"><div className="auth-aside"><Link className="brand" to="/login"><span className="brand-mark">R</span><span>rememberly</span></Link><div className="auth-quote"><span>“</span><p>Administration for Rememberly.</p><small>Users, admins, and global switches only — never content.</small></div></div><main className="auth-main"><div className="auth-box"><span className="eyebrow">Restricted area</span><h1>Admin sign in</h1><p className="auth-description">Use your administrator account. End-user accounts cannot sign in here.</p><form className="auth-form" onSubmit={submit}><label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin1" autoComplete="username" /></label><label>Password<div className="password-row"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" /><button type="button" className="text-button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></label><ErrorText error={error} /><button className="button button-primary button-wide" disabled={submitting || loading}>{submitting ? 'Signing in…' : 'Sign in as admin'} <span>↗</span></button></form></div></main></div>
}

export function AdminProtected({ children }) {
  const { isAuthenticated, loading } = useAdmin()
  if (loading) return <div className="route-loading">Checking admin session…</div>
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  return children
}

function UsersTab() {
  const [users, setUsers] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async (pageNumber = 1, searchValue = appliedSearch, statusValue = statusFilter) => {
    setLoading(true)
    setError('')
    try {
      const data = await listUsers({ search: searchValue, status: statusValue, page: pageNumber })
      setUsers(data.results)
      setCount(data.count)
      setPage(pageNumber)
      setHasNext(Boolean(data.next))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1, '', '') }, [])

  const applyFilters = (event) => {
    event.preventDefault()
    setAppliedSearch(search)
    load(1, search, statusFilter)
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    if (!editing || busy) return
    setBusy(true)
    setError('')
    try {
      const updated = await patchUser(editing.id, {
        display_name: editing.display_name,
        status: editing.status,
        timezone: editing.timezone,
        default_currency: editing.default_currency,
      })
      setUsers((rows) => rows.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)))
      setEditing(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    setBusy(true)
    setError('')
    try {
      await deleteUser(id)
      setUsers((rows) => rows.filter((row) => row.id !== id))
      setCount((value) => value - 1)
      setConfirmDelete(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <section aria-label="User management">
    <form className="inline-form" onSubmit={applyFilters}>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email or name" aria-label="Search users" />
      <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setAppliedSearch(search); load(1, search, event.target.value) }} aria-label="Filter by status">
        <option value="">All statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="SUSPENDED">Suspended</option>
      </select>
      <button className="button button-primary">Search</button>
    </form>
    <p className="field-help">{count} user{count === 1 ? '' : 's'} · content is never shown here</p>
    <ErrorText error={error} />
    {loading ? <div className="loading-state">Loading users…</div> : (
      <table className="admin-table">
        <thead><tr><th>Email</th><th>Name</th><th>Status</th><th>Notes</th><th>Items</th><th>Last seen</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map((user) => (
            editing?.id === user.id ? (
              <tr key={user.id}><td colSpan={7}>
                <form className="inline-form" onSubmit={saveEdit}>
                  <input value={editing.display_name} onChange={(event) => setEditing({ ...editing, display_name: event.target.value })} placeholder="Display name" aria-label="Display name" maxLength={120} />
                  <select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })} aria-label="Account status">
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                  <input value={editing.timezone} onChange={(event) => setEditing({ ...editing, timezone: event.target.value })} placeholder="Timezone" aria-label="Timezone" />
                  <input value={editing.default_currency} onChange={(event) => setEditing({ ...editing, default_currency: event.target.value.toUpperCase() })} placeholder="BDT" aria-label="Default currency" maxLength={3} />
                  <button className="button button-primary" disabled={busy}>Save</button>
                  <button className="button button-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              </td></tr>
            ) : (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.display_name || '—'}</td>
                <td>{user.status}</td>
                <td>{user.notes_count}</td>
                <td>{user.confirmed_items_count}</td>
                <td>{user.last_seen_at ? new Date(user.last_seen_at).toLocaleDateString() : '—'}</td>
                <td className="admin-actions">
                  <button className="text-button" onClick={() => setEditing({ ...user })}>Edit</button>
                  {confirmDelete === user.id
                    ? <><button className="text-button danger-text" disabled={busy} onClick={() => remove(user.id)}>Confirm delete</button><button className="text-button" onClick={() => setConfirmDelete(null)}>Keep</button></>
                    : <button className="text-button danger-text" onClick={() => setConfirmDelete(user.id)}>Delete</button>}
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    )}
    <div className="admin-pager">
      <button className="button button-ghost" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>← Prev</button>
      <span>Page {page}</span>
      <button className="button button-ghost" disabled={!hasNext || loading} onClick={() => load(page + 1)}>Next →</button>
    </div>
  </section>
}

function AdminsTab() {
  const { canManageAdmins } = useAdmin()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'ADMIN' })

  useEffect(() => {
    if (!canManageAdmins) { setLoading(false); return }
    listAdmins().then(setAdmins).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }, [canManageAdmins])

  if (!canManageAdmins) return <p className="form-error">Only super-admins can manage administrator accounts.</p>

  const add = async (event) => {
    event.preventDefault()
    if (busy) return
    if (form.password.length < 6) { setError('Use at least 6 password characters.'); return }
    setBusy(true)
    setError('')
    try {
      const created = await createAdmin(form)
      setAdmins((rows) => [created, ...rows])
      setForm({ username: '', email: '', password: '', role: 'ADMIN' })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (admin, changes) => {
    setBusy(true)
    setError('')
    try {
      const updated = await patchAdmin(admin.id, changes)
      setAdmins((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <section aria-label="Admin management">
    <h2>Add admin</h2>
    <form className="inline-form" onSubmit={add}>
      <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Username" aria-label="New admin username" required />
      <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email (optional)" aria-label="New admin email" />
      <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Password (6+ chars)" aria-label="New admin password" required minLength={6} autoComplete="new-password" />
      <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} aria-label="New admin role">
        <option value="ADMIN">Admin</option>
        <option value="SUPER_ADMIN">Super admin</option>
      </select>
      <button className="button button-primary" disabled={busy}>Add admin</button>
    </form>
    <PasswordStrength password={form.password} />
    <ErrorText error={error} />
    {loading ? <div className="loading-state">Loading admins…</div> : (
      <table className="admin-table">
        <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>
          {admins.map((admin) => <tr key={admin.id}>
            <td>{admin.username}</td>
            <td>{admin.email || '—'}</td>
            <td>{admin.role}</td>
            <td>{admin.is_active ? 'Yes' : 'No'}</td>
            <td className="admin-actions">
              <button className="text-button" disabled={busy} onClick={() => toggle(admin, { is_active: !admin.is_active })}>
                {admin.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button className="text-button" disabled={busy} onClick={() => toggle(admin, { role: admin.role === 'SUPER_ADMIN' ? 'ADMIN' : 'SUPER_ADMIN' })}>
                Make {admin.role === 'SUPER_ADMIN' ? 'admin' : 'super admin'}
              </button>
            </td>
          </tr>)}
        </tbody>
      </table>
    )}
  </section>
}

function TrialKeysManager() {
  const { canManageAdmins } = useAdmin()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ label: '', key: '' })

  useEffect(() => {
    if (!canManageAdmins) { setLoading(false); return }
    listTrialKeys().then(setKeys).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }, [canManageAdmins])

  if (!canManageAdmins) return null

  const add = async (event) => {
    event.preventDefault()
    if (busy || !form.key.trim()) return
    setBusy(true)
    setError('')
    try {
      const created = await createTrialKey({ label: form.label.trim(), key: form.key.trim() })
      setKeys((rows) => [...rows, created])
      setForm({ label: '', key: '' })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (key) => {
    setBusy(true)
    setError('')
    try {
      const updated = await patchTrialKey(key.id, { is_active: !key.is_active })
      setKeys((rows) => rows.map((row) => (row.id === updated.id ? updated : row)))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    setBusy(true)
    setError('')
    try {
      await deleteTrialKey(id)
      setKeys((rows) => rows.filter((row) => row.id !== id))
      setConfirmDelete(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <section aria-label="Trial key pool">
    <h2>Trial key pool</h2>
    <p className="field-help">Server keys for the Free trial, used least-recently-used first. When one hits its limit, add the next here — no redeploy. Values are encrypted and never shown again after saving.</p>
    <form className="inline-form" onSubmit={add}>
      <input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Label (e.g. key-2)" aria-label="New trial key label" maxLength={80} />
      <input type="password" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="gsk_…" aria-label="New trial key value" required autoComplete="new-password" />
      <button className="button button-primary" disabled={busy}>Add key</button>
    </form>
    <ErrorText error={error} />
    {loading ? <div className="loading-state">Loading trial keys…</div> : keys.length === 0 ? <p className="field-help">No pool keys yet — trials fall back to the server .env key.</p> : (
      <table className="admin-table">
        <thead><tr><th>Label</th><th>Key</th><th>Active</th><th>Uses</th><th>Failures</th><th>Last used</th><th>Actions</th></tr></thead>
        <tbody>
          {keys.map((key) => <tr key={key.id}>
            <td>{key.label}{key.disabled_reason && <small> · auto-disabled: {key.disabled_reason}</small>}</td>
            <td><span className="mono">{key.masked}</span></td>
            <td>{key.is_active ? 'Yes' : 'No'}</td>
            <td>{key.use_count}</td>
            <td>{key.consecutive_failures}</td>
            <td>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : '—'}</td>
            <td className="admin-actions">
              <button className="text-button" disabled={busy} onClick={() => toggle(key)}>{key.is_active ? 'Deactivate' : 'Activate'}</button>
              {confirmDelete === key.id
                ? <><button className="text-button danger-text" disabled={busy} onClick={() => remove(key.id)}>Confirm delete</button><button className="text-button" onClick={() => setConfirmDelete(null)}>Keep</button></>
                : <button className="text-button danger-text" onClick={() => setConfirmDelete(key.id)}>Delete</button>}
            </td>
          </tr>)}
        </tbody>
      </table>
    )}
  </section>
}

function AiTab() {
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAiSettings().then((data) => setEnabled(data.server_ai_enabled)).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }, [])

  const toggle = async () => {
    setSaving(true)
    setError('')
    try {
      const data = await patchAiSettings(!enabled)
      setEnabled(data.server_ai_enabled)
      setSaved(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return <section aria-label="AI settings">
    <h2>Shared Groq key</h2>
    <p className="field-help">Controls the server-owned Groq key used by the Free trial. Personal session keys are never affected. Default is on.</p>
    <ErrorText error={error} />
    {loading ? <div className="loading-state">Loading AI settings…</div> : (
      <label className="setting-row">
        <span><strong>Free trial with shared key</strong><small>{enabled ? 'On — trial analysis uses the server key' : 'Off — trial analysis is unavailable'}</small></span>
        <input type="checkbox" checked={enabled} onChange={toggle} disabled={saving} aria-label="Free trial with shared key" />
      </label>
    )}
    {saved && <p className="form-success">AI setting saved</p>}
    <TrialKeysManager />
  </section>
}

export function AdminDashboardPage() {
  const { admin, logout } = useAdmin()
  const navigate = useNavigate()
  const [tab, setTab] = useState('users')
  const handleLogout = async () => { try { await logout() } finally { navigate('/admin/login') } }
  return <div className="admin-shell">
    <header className="admin-topbar">
      <Link className="brand" to="/admin"><span className="brand-mark">R</span><span>rememberly admin</span></Link>
      <div className="admin-identity"><span>{admin?.username} · {admin?.role}</span><button className="logout-button" onClick={handleLogout}>Log out <span>↗</span></button></div>
    </header>
    <main className="admin-main">
      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {[['users', 'Users'], ['admins', 'Admins'], ['ai', 'AI settings']].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'admins' && <AdminsTab />}
      {tab === 'ai' && <AiTab />}
    </main>
  </div>
}
