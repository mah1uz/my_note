import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { setAccessToken } from '../api/http'
import { setAdminToken } from '../api/adminApi'
import { installSupabaseMock } from '../test/supabaseMock'
import { AdminProvider } from '../context/AdminContext'
import { AuthProvider } from '../context/AuthContext'

const superAdmin = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', username: 'admin1', email: 'admin1@example.com', role: 'SUPER_ADMIN', is_active: true }
const state = {
  users: [{ id: '11111111-1111-4111-8111-111111111111', email: 'managed@example.com', display_name: 'Managed', status: 'ACTIVE', notes_count: 2, confirmed_items_count: 1, last_seen_at: '2026-09-21T08:00:00Z' }],
  admins: [{ ...superAdmin }],
  aiEnabled: true,
  trialKeys: [],
}

function jsonResponse(data, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  }))
}

function installAdminMock() {
  vi.stubGlobal('fetch', vi.fn(async (input, options = {}) => {
    const url = new URL(input)
    const path = url.pathname
    const method = options.method || 'GET'
    const body = options.body ? JSON.parse(options.body) : {}
    if (path.endsWith('/admin/login/')) {
      if (body.password === 'wrong') return jsonResponse({ detail: 'Invalid credentials.' }, 400)
      return jsonResponse({ token: 'admin-token', admin: { ...superAdmin }, can_manage_admins: true })
    }
    if (options.headers?.Authorization !== 'Token admin-token') {
      return jsonResponse({ detail: 'Authentication required.' }, 401)
    }
    if (path.endsWith('/admin/me/')) return jsonResponse({ admin: { ...superAdmin }, can_manage_admins: true })
    if (path.endsWith('/admin/logout/')) return jsonResponse(null, 204)
    if (path.endsWith('/admin/users/') && method === 'GET') {
      return jsonResponse({ count: state.users.length, next: null, previous: null, results: state.users })
    }
    if (path.endsWith('/admin/ai-settings/')) {
      if (method === 'PATCH') state.aiEnabled = body.server_ai_enabled
      return jsonResponse({ server_ai_enabled: state.aiEnabled })
    }
    if (path.endsWith('/admin/trial-keys/')) {
      if (method === 'POST') {
        const created = {
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', label: body.label || 'Trial key',
          masked: `••••${String(body.key || '').slice(-4)}`, is_active: true,
          use_count: 0, consecutive_failures: 0, disabled_reason: '',
          created_at: '2026-09-24T08:00:00Z', last_used_at: null,
        }
        state.trialKeys.push(created)
        return jsonResponse(created, 201)
      }
      return jsonResponse(state.trialKeys)
    }
    const keyMatch = path.match(/\/admin\/trial-keys\/(.+)\/$/)
    if (keyMatch) {
      const key = state.trialKeys.find((entry) => entry.id === keyMatch[1])
      if (!key) return jsonResponse({ detail: 'Not found.' }, 404)
      if (method === 'PATCH') Object.assign(key, body)
      if (method === 'DELETE') state.trialKeys = state.trialKeys.filter((entry) => entry.id !== key.id)
      return jsonResponse(method === 'DELETE' ? null : key, method === 'DELETE' ? 204 : 200)
    }
    if (path.endsWith('/admin/admins/')) {
      if (method === 'POST') {
        const created = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', username: body.username, email: body.email || '', role: body.role || 'ADMIN', is_active: true }
        state.admins.unshift(created)
        return jsonResponse(created, 201)
      }
      return jsonResponse(state.admins)
    }
    throw new Error(`Unhandled admin API request: ${method} ${path}`)
  }))
}

function renderAdmin(path = '/admin/login') {
  window.history.pushState({}, '', path)
  return render(<AdminProvider><AuthProvider><App /></AuthProvider></AdminProvider>)
}

describe('Admin dashboard', () => {
  beforeEach(() => {
    setAccessToken(null)
    setAdminToken(null)
    try { window.sessionStorage.clear() } catch { /* private mode */ }
    state.users = [{ id: '11111111-1111-4111-8111-111111111111', email: 'managed@example.com', display_name: 'Managed', status: 'ACTIVE', notes_count: 2, confirmed_items_count: 1, last_seen_at: '2026-09-21T08:00:00Z' }]
    state.admins = [{ ...superAdmin }]
    state.aiEnabled = true
    state.trialKeys = []
    window.history.pushState({}, '', '/')
    installSupabaseMock({ authenticated: false, profile: {} })
    installAdminMock()
  })

  it('redirects /admin to login and signs in through the API', async () => {
    const user = userEvent.setup()
    renderAdmin('/admin')
    expect(await screen.findByRole('heading', { name: /admin sign in/i })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Username'), 'admin1')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in as admin/i }))
    expect(await screen.findByText('managed@example.com')).toBeInTheDocument()
    expect(screen.getByText('admin1 · SUPER_ADMIN')).toBeInTheDocument()
  })

  it('rejects invalid admin credentials', async () => {
    const user = userEvent.setup()
    renderAdmin('/admin/login')
    await user.type(screen.getByLabelText('Username'), 'admin1')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in as admin/i }))
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument()
  })

  it('toggles the shared-key switch through the API', async () => {
    const user = userEvent.setup()
    renderAdmin('/admin/login')
    await user.type(screen.getByLabelText('Username'), 'admin1')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in as admin/i }))
    await screen.findByText('managed@example.com')
    await user.click(screen.getByRole('tab', { name: 'AI settings' }))
    const toggle = await screen.findByLabelText('Free trial with shared key')
    expect(toggle).toBeChecked()
    await user.click(toggle)
    await waitFor(() => expect(state.aiEnabled).toBe(false))
    const patches = fetch.mock.calls.filter(([url, options]) => url.endsWith('/admin/ai-settings/') && options?.method === 'PATCH')
    expect(JSON.parse(patches[0][1].body)).toEqual({ server_ai_enabled: false })
    expect(await screen.findByText('AI setting saved')).toBeInTheDocument()
  })

  it('adds an admin through the API', async () => {
    const user = userEvent.setup()
    renderAdmin('/admin/login')
    await user.type(screen.getByLabelText('Username'), 'admin1')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in as admin/i }))
    await screen.findByText('managed@example.com')
    await user.click(screen.getByRole('tab', { name: 'Admins' }))
    const dialog = await screen.findByLabelText('Admin management')
    await user.type(within(dialog).getByLabelText('New admin username'), 'newbie')
    await user.type(within(dialog).getByLabelText('New admin password'), 'StrongPass!2026')
    await user.click(within(dialog).getByRole('button', { name: 'Add admin' }))
    expect(await within(dialog).findByText('newbie')).toBeInTheDocument()
    const posts = fetch.mock.calls.filter(([url, options]) => url.endsWith('/admin/admins/') && options?.method === 'POST')
    expect(JSON.parse(posts[0][1].body).username).toBe('newbie')
  })

  it('adds a trial key and only ever shows the masked value', async () => {
    const user = userEvent.setup()
    renderAdmin('/admin/login')
    await user.type(screen.getByLabelText('Username'), 'admin1')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in as admin/i }))
    await screen.findByText('managed@example.com')
    await user.click(screen.getByRole('tab', { name: 'AI settings' }))
    const pool = await screen.findByLabelText('Trial key pool')
    await user.type(within(pool).getByLabelText('New trial key label'), 'key-2')
    await user.type(within(pool).getByLabelText('New trial key value'), 'gsk_testkey_7890')
    await user.click(within(pool).getByRole('button', { name: 'Add key' }))
    expect(await within(pool).findByText('••••7890')).toBeInTheDocument()
    expect(within(pool).queryByText('gsk_testkey_7890')).not.toBeInTheDocument()
    expect(within(pool).getByLabelText('New trial key value')).toHaveValue('')
    const posts = fetch.mock.calls.filter(([url, options]) => url.endsWith('/admin/trial-keys/') && options?.method === 'POST')
    expect(JSON.parse(posts[0][1].body)).toEqual({ label: 'key-2', key: 'gsk_testkey_7890' })
  })
})
