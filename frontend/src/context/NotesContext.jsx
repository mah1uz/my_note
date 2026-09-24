import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createNote, editNote, getNote, listNotes, removeNote } from '../api/notesApi'
import { useAuth } from './AuthContext'

const NotesContext = createContext(null)

export function NotesProvider({ children }) {
  const { currentUser, isAuthenticated } = useAuth()
  const [notes, setNotes] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [epoch, setEpoch] = useState(0)
  const [page, setPage] = useState(1)
  const accountIdRef = useRef(currentUser?.id)
  accountIdRef.current = currentUser?.id

  useEffect(() => {
    if (!isAuthenticated) {
      setNotes([])
      setTotal(0)
      setHasMore(false)
      setError('')
      return
    }
    let active = true
    setLoading(true)
    setNotes([])
    setError('')
    setPage(1)
    listNotes().then((data) => {
      if (active) {
        setNotes(data.notes)
        setTotal(data.total)
        setHasMore(data.hasMore)
      }
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [currentUser?.id, isAuthenticated, epoch])

  const loadMore = async () => {
    const accountId = accountIdRef.current
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const data = await listNotes(page + 1)
      if (accountIdRef.current !== accountId) throw new Error('The authenticated account changed. Please try again.')
      setNotes((current) => [...current, ...data.notes])
      setTotal(data.total)
      setHasMore(data.hasMore)
      setPage((value) => value + 1)
    } catch (requestError) {
      if (accountIdRef.current === accountId) setError(requestError.message)
      throw requestError
    } finally {
      setLoadingMore(false)
    }
  }

  const addNote = async (text) => {
    const accountId = accountIdRef.current
    try {
      const note = await createNote(text.trim())
      if (accountIdRef.current !== accountId) throw new Error('The authenticated account changed. Please try again.')
      setNotes((current) => [note, ...current])
      setTotal((value) => value + 1)
      setError('')
      return note
    } catch (requestError) {
      if (accountIdRef.current === accountId) setError(requestError.message)
      throw requestError
    }
  }

  const loadNote = async (id) => {
    const accountId = accountIdRef.current
    try {
      const note = await getNote(id)
      if (accountIdRef.current !== accountId) throw new Error('The authenticated account changed. Please try again.')
      let isNew = false
      setNotes((current) => {
        isNew = !current.some((item) => item.id === note.id)
        return [note, ...current.filter((item) => item.id !== note.id)]
      })
      if (isNew) setTotal((value) => value + 1)
      setError('')
      return note
    } catch (requestError) {
      if (accountIdRef.current === accountId) setError(requestError.message)
      throw requestError
    }
  }

  const updateNote = async (id, text, revision) => {
    const accountId = accountIdRef.current
    try {
      const note = await editNote(id, text.trim(), revision)
      if (accountIdRef.current !== accountId) throw new Error('The authenticated account changed. Please try again.')
      setNotes((current) => current.map((item) => item.id === id ? note : item))
      setError('')
      return note
    } catch (requestError) {
      if (accountIdRef.current === accountId) setError(requestError.message)
      throw requestError
    }
  }

  const deleteNote = async (id) => {
    const accountId = accountIdRef.current
    try {
      await removeNote(id)
      if (accountIdRef.current !== accountId) throw new Error('The authenticated account changed. Please try again.')
      setNotes((current) => current.filter((note) => note.id !== id))
      setTotal((value) => Math.max(0, value - 1))
      setError('')
    } catch (requestError) {
      if (accountIdRef.current === accountId) setError(requestError.message)
      throw requestError
    }
  }

  const value = useMemo(() => ({
    notes, total, hasMore, loading, loadingMore, error,
    addNote, loadNote, updateNote, deleteNote, loadMore,
    refresh: () => setEpoch((value) => value + 1),
  }), [notes, total, hasMore, loading, loadingMore, error])
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}

export function useNotes() {
  const context = useContext(NotesContext)
  if (!context) throw new Error('useNotes must be used inside NotesProvider')
  return context
}
