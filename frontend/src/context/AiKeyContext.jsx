import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { AI_PROVIDERS, DEFAULT_AI_PROVIDER, deleteStoredKey, getStoredKeyStatus, saveStoredKey } from '../api/aiKeyApi'

const STORAGE_KEY = 'rememberly-ai-provider'

function initialProvider() {
  try {
    const saved = window.localStorage?.getItem(STORAGE_KEY)
    if (AI_PROVIDERS.includes(saved)) return saved
  } catch { /* Storage unavailable; fall through to default. */ }
  return DEFAULT_AI_PROVIDER
}

const emptyContext = {
  aiProvider: DEFAULT_AI_PROVIDER,
  setAiProvider: () => {},
  sessionKeys: { groq: '', gemini: '' },
  sessionKey: '',
  setSessionKey: () => {},
  clearSessionKeys: () => {},
  storedKeys: null,
  storedLoading: false,
  savePersonalKey: async () => {},
  removePersonalKey: async () => {},
  refreshStoredKeys: async () => {},
  trialActive: false,
  startTrial: () => {},
  endTrial: () => {},
}
const AiKeyContext = createContext(emptyContext)

export { AiKeyContext }
let clearActiveKeys = () => {}

export function clearSessionGroqKey() {
  clearActiveKeys()
}

export function AiKeyProvider({ children }) {
  const [aiProvider, setAiProviderState] = useState(initialProvider)
  const [sessionKeys, setSessionKeys] = useState({ groq: '', gemini: '' })
  const [storedKeys, setStoredKeys] = useState(null)
  const [storedLoading, setStoredLoading] = useState(false)
  const [trialActive, setTrialActive] = useState(false)

  const setAiProvider = (provider) => {
    if (!AI_PROVIDERS.includes(provider)) return
    setAiProviderState(provider)
    try { window.localStorage?.setItem(STORAGE_KEY, provider) } catch { /* ignore */ }
  }
  const setSessionKey = (key) => setSessionKeys((current) => ({ ...current, [aiProvider]: String(key || '').trim() }))
  const clearSessionKeys = () => {
    setSessionKeys({ groq: '', gemini: '' })
    setTrialActive(false)
  }

  const loadStatuses = async (signal) => {
    const entries = await Promise.all(AI_PROVIDERS.map(async (provider) => {
      try {
        const status = await getStoredKeyStatus(provider, signal)
        return [provider, status]
      } catch {
        return [provider, null]
      }
    }))
    return Object.fromEntries(entries)
  }

  const refreshStoredKeys = async () => {
    setStoredLoading(true)
    try {
      const statuses = await loadStatuses()
      setStoredKeys(statuses)
      return statuses
    } catch {
      return null
    } finally {
      setStoredLoading(false)
    }
  }

  const savePersonalKey = async (key, provider = aiProvider) => {
    const status = await saveStoredKey(String(key || '').trim(), provider)
    setStoredKeys((current) => ({ ...(current || {}), [status.provider || provider]: status }))
    setSessionKeys((current) => ({ ...current, [provider]: '' }))
    return status
  }

  const removePersonalKey = async (provider = aiProvider) => {
    try {
      await deleteStoredKey(provider)
    } catch {
      // Backend delete is idempotent; still clear local state.
    } finally {
      setStoredKeys((current) => ({ ...(current || {}), [provider]: { has_key: false, masked: '', updated_at: null, provider } }))
      setSessionKeys((current) => ({ ...current, [provider]: '' }))
      setTrialActive(false)
    }
  }

  const startTrial = () => {
    setSessionKeys({ groq: '', gemini: '' })
    setTrialActive(true)
  }
  const endTrial = () => setTrialActive(false)

  useEffect(() => {
    clearActiveKeys = () => {
      setSessionKeys({ groq: '', gemini: '' })
      setStoredKeys(null)
      setTrialActive(false)
    }
    return () => {
      clearActiveKeys = () => {}
    }
  }, [])

  useEffect(() => {
    let active = true
    const load = () => {
      loadStatuses().then((statuses) => {
        if (active) setStoredKeys(statuses)
      }).catch(() => {})
        .finally(() => { if (active) setStoredLoading(false) })
    }
    setStoredLoading(true)
    load()
    const onAuth = () => load()
    window.addEventListener('rememberly:auth-changed', onAuth)
    return () => {
      active = false
      window.removeEventListener('rememberly:auth-changed', onAuth)
    }
  }, [])

  const value = useMemo(
    () => ({
      aiProvider, setAiProvider, sessionKeys, sessionKey: sessionKeys[aiProvider] || '',
      setSessionKey, clearSessionKeys, storedKeys, storedLoading,
      savePersonalKey, removePersonalKey, refreshStoredKeys, trialActive, startTrial, endTrial,
      // Legacy read aliases for the Groq-only era (tests/external harnesses).
      groqApiKey: sessionKeys.groq || '', storedKey: storedKeys?.groq || null,
    }),
    [aiProvider, sessionKeys, storedKeys, storedLoading, trialActive],
  )
  return <AiKeyContext.Provider value={value}>{children}</AiKeyContext.Provider>
}

export function useAiKey() {
  return useContext(AiKeyContext)
}
