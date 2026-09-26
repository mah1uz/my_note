import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { listItems } from '../api/itemsApi'
import { useAuth } from './AuthContext'

const ItemsContext = createContext(null)

export function ItemsProvider({ children }) {
  const { currentUser } = useAuth()
  const owner = currentUser?.id
  const [state, setState] = useState({ owner: null, items: [], loading: true, error: '' })
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    if (!owner) return undefined
    const controller = new AbortController()
    listItems('', { signal: controller.signal }).then((items) => {
      if (!controller.signal.aborted) setState({ owner, items: Array.isArray(items) ? items : [], loading: false, error: '' })
    }).catch(() => {
      if (!controller.signal.aborted) setState((current) => ({
        owner, items: current.owner === owner ? current.items : [], loading: false, error: 'Categories are unavailable right now.',
      }))
    })
    return () => controller.abort()
  }, [owner, epoch])

  useEffect(() => {
    const onChange = () => setEpoch((value) => value + 1)
    window.addEventListener('rememberly:items-changed', onChange)
    return () => window.removeEventListener('rememberly:items-changed', onChange)
  }, [])

  const value = useMemo(() => ({
    ...(state.owner === owner && owner ? state : { owner, items: [], loading: Boolean(owner), error: '' }),
    refresh: () => setEpoch((value) => value + 1),
    patchLocal: (id, changes) => setState((current) => current.owner === owner ? ({
      ...current,
      items: current.items.map((item) => String(item.id) === String(id) ? { ...item, ...changes } : item),
    }) : current),
    commitItem: (saved) => setState((current) => current.owner === owner ? ({
      ...current,
      items: current.items.map((item) => String(item.id) === String(saved.id) ? saved
        : String(item.note) === String(saved.note) ? { ...item, revision: saved.revision } : item),
    }) : current),
  }), [state, owner])
  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>
}

export function useConfirmedItems() {
  const context = useContext(ItemsContext)
  if (!context) throw new Error('useConfirmedItems must be used inside ItemsProvider')
  return context
}
