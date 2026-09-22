import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeOnboarding, getSettings } from '../../api/onboardingApi'

const profiles = [['BALANCED', 'Balanced', 'A steady mix of work, study, and life.'], ['STUDY_FIRST', 'Study first', 'Keep learning and deadlines close at hand.'], ['WORK_FIRST', 'Work first', 'Prioritize professional momentum and follow-through.']]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [profession, setProfession] = useState('')
  const [priority, setPriority] = useState('BALANCED')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { getSettings().then((data) => { setProfession(data.preferences.profession || ''); setPriority(data.preferences.priority_profile || 'BALANCED') }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false)) }, [])
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try { await completeOnboarding({ profession: profession.trim(), priority_profile: priority, onboarding_tour_version: 1 }); navigate('/app', { replace: true }) } catch (requestError) { setError(requestError.message) } finally { setSaving(false) }
  }
  if (loading) return <div className="loading-state">Preparing your space…</div>
  return <div className="onboarding-page"><div className="onboarding-orbit"><span className="orbit-dot one" /><span className="orbit-dot two" /><span className="orbit-dot three" /></div><div className="onboarding-content"><span className="eyebrow">A small beginning</span><h1>Make Rememberly feel like yours.</h1><p className="onboarding-lede">A couple of choices help us shape your daily view. You can change them anytime.</p><form className="onboarding-form" onSubmit={submit}><label>What best describes your season? <span>Optional</span><select value={profession} onChange={(event) => setProfession(event.target.value)} aria-label="Profession"><option value="">Choose one</option><option value="STUDENT">Student</option><option value="EMPLOYED">Working</option><option value="BOTH">Studying and working</option><option value="OTHER">Something else</option><option value="PREFER_NOT_TO_SAY">Prefer not to say</option></select></label><fieldset><legend>What should feel closest?</legend><div className="profile-options">{profiles.map(([value, title, description]) => <button type="button" key={value} className={priority === value ? 'profile-option selected' : 'profile-option'} onClick={() => setPriority(value)} aria-pressed={priority === value}><span className="profile-radio" /><span><strong>{title}</strong><small>{description}</small></span></button>)}</div></fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="onboarding-actions"><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Continue'} <span>→</span></button><button type="button" className="button button-ghost" onClick={() => navigate('/app')}>Skip for now</button></div></form></div></div>
}
