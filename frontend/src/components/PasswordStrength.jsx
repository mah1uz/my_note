export function getPasswordStrength(password) {
  const value = String(password || '')
  const length6 = value.length >= 6
  const hasLower = /[a-z]/.test(value)
  const hasUpper = /[A-Z]/.test(value)
  const hasDigit = /[0-9]/.test(value)
  const hasSymbol = /[^A-Za-z0-9]/.test(value)
  const score = [length6, hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length
  // Green only when all 5 conditions are met. Length is a gate:
  // a short password stays red even if other classes match.
  let level = 'weak'
  if (score >= 5 && length6) level = 'strong'
  else if (score >= 3 && length6) level = 'medium'
  return { length6, hasLower, hasUpper, hasDigit, hasSymbol, score, level }
}

const CONDITIONS = [
  { key: 'length6', label: 'At least 6 characters' },
  { key: 'hasLower', label: 'Lowercase letter (a-z)' },
  { key: 'hasUpper', label: 'Uppercase letter (A-Z)' },
  { key: 'hasDigit', label: 'Number (0-9)' },
  { key: 'hasSymbol', label: 'Symbol (!@#$…)' },
]

const LEVEL_LABEL = { weak: 'Weak', medium: 'Medium', strong: 'Strong' }

export default function PasswordStrength({ password }) {
  const result = getPasswordStrength(password)
  if (!password) return null
  return (
    <div className={`password-strength is-${result.level}`} aria-live="polite">
      <div className="password-strength-bar" aria-hidden="true">
        <span className="password-strength-seg" />
        <span className="password-strength-seg" />
        <span className="password-strength-seg" />
      </div>
      <p className="password-strength-label">
        Strength: <strong>{LEVEL_LABEL[result.level]}</strong> ({result.score}/5)
      </p>
      <ul className="password-strength-list">
        {CONDITIONS.map((condition) => {
          const met = Boolean(result[condition.key])
          return (
            <li key={condition.key} className={met ? 'met' : ''}>
              <span className="password-strength-tick" aria-hidden="true">
                {met ? '✓' : '○'}
              </span>
              {condition.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
