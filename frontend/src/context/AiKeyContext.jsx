import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { deleteStoredKey, getStoredKeyStatus, saveStoredKey } from '../api/aiKeyApi'

const emptyContext = {
  groqApiKey: '',
  storedKey: null,
  storedLoading: false,
  setGroqApiKey: () => {},
  clearGroqApiKey: () => {},
  savePersonalKey: async () => {},
  removePersonalKey: async () => {},
  refreshStoredKey: async () => {},
  trialActive: false,
  startTrial: () => {},
  endTrial: () => {},
}
const AiKeyContext = createContext(emptyContext)

export { AiKeyContext }
let clearActiveGroqKey = () => {}

export function clearSessionGroqKey() {
  clearActiveGroqKey()
}

export function AiKeyProvider({ children }) {
  const [groqApiKey, setGroqApiKeyState] = useState('')
  const [storedKey, setStoredKey] = useState(null)
  const [storedLoading, setStoredLoading] = useState(false)
  const [trialActive, setTrialActive] = useState(false)
  const setGroqApiKey = (key) => setGroqApiKeyState(String(key || '').trim())
  const clearGroqApiKey = () => {
    setGroqApiKeyState('')
    setTrialActive(false)
  }
  const refreshStoredKey = async () => {
    setStoredLoading(true)
    try {
      const status = await getStoredKeyStatus()
      if (status && typeof status.has_key !== 'undefined') setStoredKey(status)
      return status
    } catch {
      return null
    } finally {
      setStoredLoading(false)
    }
  }
  const savePersonalKey = async (key) => {
    const status = await saveStoredKey(String(key || '').trim())
    setStoredKey(status)
    setGroqApiKeyState('')
    return status
  }
  const removePersonalKey = async () => {
    try {
      await deleteStoredKey()
    } catch {
      // Backend delete is idempotent; still clear local state.
    } finally {
      setStoredKey({ has_key: false, masked: '', updated_at: null })
      setGroqApiKeyState('')
      setTrialActive(false)
    }
  }
  const startTrial = () => {
    setGroqApiKeyState('')
    setTrialActive(true)
  }
  const endTrial = () => setTrialActive(false)

  useEffect(() => {
    clearActiveGroqKey = () => {
      setGroqApiKeyState('')
      setStoredKey(null)
      setTrialActive(false)
    }
    return () => {
      clearActiveGroqKey = () => {}
    }
  }, [])

  useEffect(() => {
    let active = true
    const load = () => {
      getStoredKeyStatus().then((status) => {
        if (active && status && typeof status.has_key !== 'undefined') setStoredKey(status)
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
    () => ({ groqApiKey, storedKey, storedLoading, setGroqApiKey, clearGroqApiKey, savePersonalKey, removePersonalKey, refreshStoredKey, trialActive, startTrial, endTrial }),
    [groqApiKey, storedKey, storedLoading, trialActive],
  )
  return <AiKeyContext.Provider value={value}>{children}</AiKeyContext.Provider>
}

export function useAiKey() {
  return useContext(AiKeyContext)
}
