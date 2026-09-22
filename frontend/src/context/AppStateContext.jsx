import { createContext, useContext, useMemo, useState } from 'react'
import {
  mockDashboardItems,
  mockPlaces,
  mockTasks,
} from '../data/mockData'

const AppStateContext = createContext(null)

const clone = (value) => value.map((item) => ({ ...item, domains: item.domains ? [...item.domains] : item.domains, itemIds: item.itemIds ? [...item.itemIds] : item.itemIds }))

export function AppStateProvider({ children }) {
  // The final intelligent dashboard belongs to Part 6; its summary is still a prototype.
  const [tasks] = useState(() => clone(mockTasks))
  const [places, setPlaces] = useState(() => clone(mockPlaces))

  const addPlace = (place) => setPlaces((current) => [...current, { ...place, id: `place-${Date.now()}` }])
  const updatePlace = (id, changes) => setPlaces((current) => current.map((place) => place.id === id ? { ...place, ...changes } : place))
  const deletePlace = (id) => setPlaces((current) => current.filter((place) => place.id !== id))

  const value = useMemo(() => ({
    tasks, places, dashboardItems: mockDashboardItems,
    addPlace, updatePlace, deletePlace
  }), [tasks, places])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) throw new Error('useAppState must be used inside AppStateProvider')
  return context
}
