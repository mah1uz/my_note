import { useCallback, useRef } from 'react'
import { analyzeNote, confirmAnalysis } from '../../api/itemsApi'
import { useAiKey } from '../../context/AiKeyContext'
import { useNotes } from '../../context/NotesContext'
import { itemForm, itemPayload } from '../items/itemForm'

/** True when AI can run: personal key (session or saved) or trial. */
export function isAiConfigured({ groqApiKey = '', storedKey = null, trialActive = false } = {}) {
  return Boolean(groqApiKey || storedKey?.has_key || trialActive)
}

/**
 * Fully automatic organization for one note: analyze, then confirm every
 * draft unedited (the same path as card-tick auto).
 * Resolves { status: 'confirmed' } or { status: 'no-drafts', review }.
 * Throws the API error on failure. Refreshing the notes list is the
 * caller's job; the shared items cache is notified by confirmAnalysis.
 */
export async function autoOrganize(note, { apiKey = '', trial = false } = {}) {
  const reviewed = await analyzeNote(note.id, note.revision, apiKey, trial)
  const drafts = (reviewed.items || []).filter((item) => !item.is_confirmed)
  if (!drafts.length) return { status: 'no-drafts', review: reviewed }
  const confirmed = await confirmAnalysis(
    note.id, reviewed.note.revision, drafts.map((draft) => itemPayload(itemForm(draft))),
  )
  return { status: 'confirmed', review: confirmed }
}

/**
 * Fire-and-forget auto-organize for freshly created notes only. Edits are
 * excluded on purpose: editing keeps previously confirmed items, so an
 * automatic confirm would silently stack a duplicate generation.
 */
export function useAutoOrganize() {
  const { groqApiKey, storedKey, trialActive } = useAiKey()
  const { refresh } = useNotes()
  const runningRef = useRef(new Set())

  const organize = useCallback((note) => {
    const credentials = { groqApiKey, storedKey, trialActive }
    if (!isAiConfigured(credentials)) return Promise.resolve({ status: 'skipped-no-credential' })
    const key = String(note.id)
    if (runningRef.current.has(key)) return Promise.resolve({ status: 'already-running' })
    runningRef.current.add(key)
    return autoOrganize(note, { apiKey: groqApiKey, trial: trialActive })
      .then((result) => {
        refresh()
        return result
      })
      .catch((requestError) => {
        // Refresh anyway: the note may now read PROCESSING or FAILED.
        refresh()
        throw requestError
      })
      .finally(() => {
        runningRef.current.delete(key)
      })
  }, [groqApiKey, storedKey, trialActive, refresh])

  return {
    organize,
    configured: isAiConfigured({ groqApiKey, storedKey, trialActive }),
  }
}
