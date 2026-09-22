import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ArrowLeftIcon, ArrowRightIcon, CheckIcon, CloseIcon, DashboardIcon, EventsIcon,
  LogoutIcon, MenuIcon, NavIcon, NotesIcon, PlacesIcon, SearchIcon, SettingsIcon,
  ShoppingIcon, SparkleIcon, StudyIcon, TasksIcon, TransactionsIcon, PlusIcon,
} from './icons'

const all = [
  DashboardIcon, NotesIcon, TasksIcon, EventsIcon, ShoppingIcon, TransactionsIcon,
  PlacesIcon, SearchIcon, SettingsIcon, StudyIcon, PlusIcon, CloseIcon,
  ArrowRightIcon, ArrowLeftIcon, MenuIcon, LogoutIcon, CheckIcon, SparkleIcon,
]

describe('thematic icon system', () => {
  it('renders every icon as a decorative, currentColor SVG', () => {
    for (const Icon of all) {
      const { container, unmount } = render(<Icon />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg.getAttribute('stroke')).toBe('currentColor')
      expect(svg.querySelectorAll('*').length).toBeGreaterThan(0)
      expect(container.textContent).toBe('')
      unmount()
    }
  })

  it('maps nav labels to icons with a safe fallback', () => {
    for (const label of ['Dashboard', 'Notes', 'Tasks', 'Events', 'Shopping', 'Transactions', 'Places', 'Search', 'Settings']) {
      const { container, unmount } = render(<NavIcon label={label} />)
      expect(container.querySelector('svg')).toBeInTheDocument()
      unmount()
    }
    const { container } = render(<NavIcon label="SomethingElse" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
