import { MoonIcon, SunIcon } from './icons'
import { useTheme } from '../context/ThemeContext'

/**
 * Compact physical theme switch. A sliding knob travels the track with a
 * spring-like transition; sun/moon glyphs mark each end. A real switch
 * control (role + aria-checked + keyboard operable), not a div.
 */
export default function ThemeToggle({ label = 'Toggle dark mode' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={label}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`theme-toggle${dark ? ' is-dark' : ''}`}
      onClick={toggle}
    >
      <span className="theme-toggle-glyph sun" aria-hidden="true"><SunIcon size={13} /></span>
      <span className="theme-toggle-glyph moon" aria-hidden="true"><MoonIcon size={13} /></span>
      <span className="theme-toggle-knob" aria-hidden="true" />
    </button>
  )
}
