import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { AppStateProvider } from './context/AppStateContext'

function renderApp(path = '/') {
  window.history.pushState({}, '', path)
  return render(<AppStateProvider><App /></AppStateProvider>)
}

describe('Part 1 application flows', () => {
  beforeEach(() => window.history.pushState({}, '', '/'))

  it('validates login and redirects to the dashboard', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(screen.getByText(/enter your email and password/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/email or username/i), 'maya@example.com')
    await user.type(screen.getByLabelText(/password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByRole('heading', { name: /good morning, maya/i })).toBeInTheDocument()
  })

  it('creates a note through Quick Capture and displays it in Notes', async () => {
    const user = userEvent.setup()
    renderApp('/app')
    await user.type(screen.getByLabelText(/what do you want to remember/i), 'Buy coffee from Agora')
    await user.click(screen.getByRole('button', { name: /save note/i }))
    expect(screen.getByText(/saved to your notes/i)).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: /Notes$/i })[0])
    expect(await screen.findByText('Buy coffee from Agora')).toBeInTheDocument()
  })

  it('toggles a task complete', async () => {
    const user = userEvent.setup()
    renderApp('/app/tasks')
    const task = screen.getByText('Buy eggs')
    const toggle = screen.getByRole('button', { name: /mark buy eggs complete/i })
    await user.click(toggle)
    expect(task).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark buy eggs incomplete/i })).toBeInTheDocument()
  })

  it('switches between Search Notes and Ask My Notes', async () => {
    const user = userEvent.setup()
    renderApp('/app/search')
    expect(screen.getByText(/mock semantic results/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ask my notes/i }))
    expect(screen.getByText(/mock answer · prototype/i)).toBeInTheDocument()
    expect(screen.getByText(/academic deadlines/i)).toBeInTheDocument()
  })

  it('shows one note with multiple extracted NoteItems and supports deletion', async () => {
    const user = userEvent.setup()
    renderApp('/app/notes/note-1')
    expect(screen.getByRole('heading', { name: /3 extracted items/i })).toBeInTheDocument()
    expect(screen.getByText('Class tomorrow at 10 AM')).toBeInTheDocument()
    expect(screen.getByText('Buy eggs', { selector: 'h3' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('heading', { name: /^notes$/i })).toBeInTheDocument()
    expect(screen.queryByText('Tomorrow class at 10, buy eggs afterwards, and spent ৳250 on books.')).not.toBeInTheDocument()
  })

  it('renders every planned application page', async () => {
    const routes = [
      ['/app', /good morning/i], ['/app/notes', /^notes$/i], ['/app/notes/new', /^new note$/i],
      ['/app/tasks', /^tasks$/i], ['/app/events', /^events$/i], ['/app/shopping', /^shopping$/i],
      ['/app/expenses', /^expenses$/i], ['/app/places', /^places$/i], ['/app/search', /^search$/i], ['/app/settings', /^settings$/i]
    ]
    for (const [path, heading] of routes) {
      const { unmount } = renderApp(path)
      await waitFor(() => expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument())
      unmount()
    }
  })
})
