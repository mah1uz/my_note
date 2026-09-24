import { useEffect } from 'react'

/**
 * Lock page-behind scrolling while a modal is open. Restores the previous
 * overflow on close/unmount; safe with several modals (last closer wins,
 * each cleanup restores what it saw).
 */
export default function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [active])
}
