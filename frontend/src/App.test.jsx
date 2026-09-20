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
    expect(screen.getByText('4', { selector: '.summary-number' })).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: /mark buy eggs incomplete/i }))
    expect(screen.getByRole('button', { name: /mark buy eggs complete/i })).toBeInTheDocument()
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

  it('edits a note locally', async () => {
    const user = userEvent.setup()
    renderApp('/app/notes/note-2')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const editor = screen.getByDisplayValue('I have an EM quiz on September 23.')
    await user.clear(editor)
    await user.type(editor, 'I have an EM quiz on September 24.')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(screen.getByText('I have an EM quiz on September 24.')).toBeInTheDocument()
  })

  it('validates registration and logs out locally', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByText(/use a name, email, matching passwords/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Name'), 'Maya Rahman')
    await user.type(screen.getByLabelText('Email'), 'maya@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.type(screen.getByLabelText('Confirm password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('heading', { name: /good morning, maya/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /log out/i }))
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('filters mock search results and shows an empty state', async () => {
    const user = userEvent.setup()
    renderApp('/app/search')
    const search = screen.getByRole('textbox', { name: /search your notes/i })
    await user.clear(search)
    await user.type(search, 'something impossible')
    expect(screen.getByRole('heading', { name: /no search results/i })).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'university work')
    expect(screen.getByText('EM Quiz')).toBeInTheDocument()
    expect(screen.getByText('Database Assignment')).toBeInTheDocument()
  })

  it('edits a saved place locally', async () => {
    const user = userEvent.setup()
    renderApp('/app/places')
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    const nameInput = screen.getByRole('textbox', { name: 'Place name' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Agora Market')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(screen.getByRole('heading', { name: 'Agora Market' })).toBeInTheDocument()
  })

  it('opens the mobile navigation menu', async () => {
    const user = userEvent.setup()
    renderApp('/app')
    await user.click(screen.getByRole('button', { name: /toggle menu/i }))
    expect(screen.getByRole('link', { name: 'Settings', exact: true })).toBeInTheDocument()
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
