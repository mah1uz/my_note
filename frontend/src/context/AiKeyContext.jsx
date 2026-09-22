import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const emptyContext = {
  groqApiKey: '',
  setGroqApiKey: () => {},
  clearGroqApiKey: () => {},
}
const AiKeyContext = createContext(emptyContext)
let clearActiveGroqKey = () => {}

export function clearSessionGroqKey() {
  clearActiveGroqKey()
}

export function AiKeyProvider({ children }) {
  const [groqApiKey, setGroqApiKeyState] = useState('')
  const setGroqApiKey = (key) => setGroqApiKeyState(String(key || '').trim())
  const clearGroqApiKey = () => setGroqApiKeyState('')

  useEffect(() => {
    clearActiveGroqKey = clearGroqApiKey
    return () => {
      if (clearActiveGroqKey === clearGroqApiKey) clearActiveGroqKey = () => {}
    }
  })

  const value = useMemo(() => ({ groqApiKey, setGroqApiKey, clearGroqApiKey }), [groqApiKey])
  return <AiKeyContext.Provider value={value}>{children}</AiKeyContext.Provider>
}

export function useAiKey() {
  return useContext(AiKeyContext)
}
