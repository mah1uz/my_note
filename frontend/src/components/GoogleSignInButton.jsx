import { useState } from 'react'
import { signInWithGoogle } from '../api/authApi'
import { isSupabaseConfigured } from '../api/supabaseClient'

export default function GoogleSignInButton() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!isSupabaseConfigured) return null

  const start = async () => {
    setBusy(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch (requestError) {
      setError(requestError.message || 'Google sign-in could not be started.')
      setBusy(false)
    }
  }

  return <div className="google-auth">
    <button className="button button-google button-wide" type="button" onClick={start} disabled={busy}>
      {busy ? 'Opening Google…' : 'Continue with Google'}
    </button>
    {error && <p className="form-error">{error}</p>}
  </div>
}
