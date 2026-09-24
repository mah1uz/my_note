import { SearchIcon } from './icons'

/**
 * Shared glowing retro search box. Presentational only: layers, icons,
 * input. Owners keep their own submit/navigation/fetch behavior.
 */
export default function RetroSearchBox({
  value, onChange, placeholder, ariaLabel, inputRef, showKbd = false,
}) {
  return <div className="retro-search">
    <span className="retro-glow" aria-hidden="true" />
    <span className="retro-ring retro-ring-a" aria-hidden="true" />
    <span className="retro-ring retro-ring-b" aria-hidden="true" />
    <span className="retro-ring retro-ring-c" aria-hidden="true" />
    <span className="retro-bloom" aria-hidden="true" />
    <span className="retro-search-icon" aria-hidden="true"><SearchIcon size={17} /></span>
    <input
      ref={inputRef}
      className="retro-input"
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
    {showKbd && <kbd className="retro-kbd" aria-hidden="true">⌘K</kbd>}
  </div>
}
