import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const emptyContext = {
  groqApiKey: '',
  setGroqApiKey: () => {},
  clearGroqApiKey: () => {},
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
  const [trialActive, setTrialActive] = useState(false)
  const setGroqApiKey = (key) => setGroqApiKeyState(String(key || '').trim())
  const clearGroqApiKey = () => {
    setGroqApiKeyState('')
    setTrialActive(false)
  }
  const startTrial = () => {
    setGroqApiKeyState('')
    setTrialActive(true)
  }
  const endTrial = () => setTrialActive(false)

  useEffect(() => {
    clearActiveGroqKey = clearGroqApiKey
    return () => {
      if (clearActiveGroqKey === clearGroqApiKey) clearActiveGroqKey = () => {}
    }
  })

  const value = useMemo(
    () => ({ groqApiKey, setGroqApiKey, clearGroqApiKey, trialActive, startTrial, endTrial }),
    [groqApiKey, trialActive],
  )
  return <AiKeyContext.Provider value={value}>{children}</AiKeyContext.Provider>
}

export function useAiKey() {
  return useContext(AiKeyContext)
}
