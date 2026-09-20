import { createContext, useContext, useMemo, useState } from 'react'
import {
  mockDashboardItems,
  mockEvents,
  mockExpenses,
  mockNoteItems,
  mockNotes,
  mockPlaces,
  mockShoppingGroups,
  mockTasks,
  mockUser
} from '../data/mockData'

const AppStateContext = createContext(null)

const clone = (value) => value.map((item) => ({ ...item, domains: item.domains ? [...item.domains] : item.domains, itemIds: item.itemIds ? [...item.itemIds] : item.itemIds }))

export function AppStateProvider({ children }) {
  const [user, setUser] = useState(null)
  const [notes, setNotes] = useState(() => clone(mockNotes))
  const [noteItems, setNoteItems] = useState(() => clone(mockNoteItems))
  const [tasks, setTasks] = useState(() => clone(mockTasks))
  const [places, setPlaces] = useState(() => clone(mockPlaces))

  // Part 1 deliberately simulates future extraction with small local heuristics.
  const addNote = (text) => {
    const trimmedText = text.trim()
    if (!trimmedText) return null
    const id = `note-${Date.now()}`
    const lowerText = trimmedText.toLowerCase()
    const items = []
    if (lowerText.includes('quiz') || lowerText.includes('class') || lowerText.includes('meeting')) {
      items.push({ id: `${id}-event`, noteId: id, type: 'EVENT', title: trimmedText, domain: 'Education', deadline: 'Upcoming' })
    } else if (lowerText.includes('buy') || lowerText.includes('need')) {
      items.push({ id: `${id}-task`, noteId: id, type: 'TASK', title: trimmedText, domain: 'Shopping', status: 'PENDING', importance: 'Medium' })
    } else if (lowerText.includes('spent') || lowerText.includes('bought') || lowerText.includes('taka')) {
      items.push({ id: `${id}-expense`, noteId: id, type: 'EXPENSE', title: trimmedText, domain: 'Finance', amount: 0 })
    } else {
      items.push({ id: `${id}-info`, noteId: id, type: 'INFORMATION', title: trimmedText, domain: 'Personal' })
    }
    setNoteItems((current) => [...current, ...items])
    const taskItem = items.find((item) => item.type === 'TASK')
    if (taskItem) {
      setTasks((current) => [...current, {
        id: taskItem.id,
        title: taskItem.title,
        deadline: 'Upcoming',
        status: 'PENDING',
        importance: taskItem.importance || 'Medium',
        domains: [taskItem.domain],
        place: lowerText.includes('agora') ? 'Agora' : null
      }])
    }
    setNotes((current) => [{ id, originalText: trimmedText, createdAt: new Date().toISOString(), processingStatus: 'Processed', confidence: 92, domains: [...new Set(items.map((item) => item.domain))], itemIds: items.map((item) => item.id) }, ...current])
    return id
  }

  const updateNote = (id, text) => setNotes((current) => current.map((note) => note.id === id ? { ...note, originalText: text.trim() } : note))

  const deleteNote = (id) => {
    const note = notes.find((item) => item.id === id)
    setNotes((current) => current.filter((note) => note.id !== id))
    setNoteItems((current) => current.filter((item) => item.noteId !== id))
    if (note) setTasks((current) => current.filter((task) => !note.itemIds?.includes(task.id)))
  }

  const toggleTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, status: task.status === 'DONE' ? 'PENDING' : 'DONE' } : task))

  const addPlace = (place) => setPlaces((current) => [...current, { ...place, id: `place-${Date.now()}` }])
  const deletePlace = (id) => setPlaces((current) => current.filter((place) => place.id !== id))

  const login = (identity) => setUser({ ...mockUser, email: identity || mockUser.email })
  const logout = () => setUser(null)

  const value = useMemo(() => ({
    user, notes, noteItems, tasks, events: mockEvents, expenses: mockExpenses, places,
    shoppingGroups: mockShoppingGroups, dashboardItems: mockDashboardItems,
    addNote, updateNote, deleteNote, toggleTask, addPlace, deletePlace, login, logout
  }), [user, notes, noteItems, tasks, places])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) throw new Error('useAppState must be used inside AppStateProvider')
  return context
}
