import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createNote, editNote, getNote, listNotes, removeNote } from '../api/notesApi'
import { useAuth } from './AuthContext'

const NotesContext = createContext(null)

export function NotesProvider({ children }) {
  const { currentUser, isAuthenticated } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      setNotes([])
      setError('')
      return
    }
    let active = true
    setLoading(true)
    setNotes([])
    setError('')
    listNotes().then((data) => {
      if (active) setNotes(data)
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [currentUser?.id, isAuthenticated])

  const addNote = async (text) => {
    try {
      const note = await createNote(text.trim())
      setNotes((current) => [note, ...current])
      setError('')
      return note
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    }
  }

  const loadNote = async (id) => {
    try {
      const note = await getNote(id)
      setNotes((current) => [note, ...current.filter((item) => item.id !== note.id)])
      setError('')
      return note
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    }
  }

  const updateNote = async (id, text) => {
    try {
      const note = await editNote(id, text.trim())
      setNotes((current) => current.map((item) => item.id === id ? note : item))
      setError('')
      return note
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    }
  }

  const deleteNote = async (id) => {
    try {
      await removeNote(id)
      setNotes((current) => current.filter((note) => note.id !== id))
      setError('')
    } catch (requestError) {
      setError(requestError.message)
      throw requestError
    }
  }

  const value = useMemo(() => ({ notes, loading, error, addNote, loadNote, updateNote, deleteNote }), [notes, loading, error])
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}

export function useNotes() {
  const context = useContext(NotesContext)
  if (!context) throw new Error('useNotes must be used inside NotesProvider')
  return context
}
