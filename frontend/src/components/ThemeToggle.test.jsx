import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../context/ThemeContext'
import ThemeToggle from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    const store = {}
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key) => (key in store ? store[key] : null),
        setItem: (key, value) => { store[key] = String(value) },
        removeItem: (key) => { delete store[key] },
        clear: () => { for (const key of Object.keys(store)) delete store[key] },
      },
    })
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.unstubAllGlobals()
  })

  it('toggles theme, reflects switch state, and persists the choice', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    })
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    const toggle = screen.getByRole('switch', { name: /toggle dark mode/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(document.documentElement.dataset.theme).toBe('light')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('rememberly_theme')).toBe('dark')
    await user.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('starts from the system preference when nothing is stored', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })),
    })
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('is keyboard operable', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    })
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    await user.tab()
    expect(screen.getByRole('switch')).toHaveFocus()
    await user.keyboard(' ')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
