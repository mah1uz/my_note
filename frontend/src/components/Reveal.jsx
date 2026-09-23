import { useEffect, useRef } from 'react'

/**
 * Scroll reveal: children start slightly below and settle with a soft
 * spring once they enter the viewport. One-shot (no replay on scroll
 * up/down). Falls back to visible when IntersectionObserver is missing
 * or the user prefers reduced motion.
 */
export default function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      node.classList.add('in')
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in')
          observer.unobserve(entry.target)
        }
      }
    }, { threshold: 0.12 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`reveal${className ? ` ${className}` : ''}`} style={{ '--reveal-delay': `${delay}ms` }}>
      {children}
    </div>
  )
}
