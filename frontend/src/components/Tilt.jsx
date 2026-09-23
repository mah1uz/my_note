import { useRef } from 'react'

/**
 * Pointer-following depth: a few degrees of tilt plus a small translateZ
 * lift so the surface feels tangible. Gentle return, no continuous motion.
 * Ignores touch pointers and reduced-motion users.
 */
export default function Tilt({ children, max = 4, lift = 6, className = '' }) {
  const ref = useRef(null)

  const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const onMove = (event) => {
    const node = ref.current
    if (!node || event.pointerType === 'touch' || reduceMotion()) return
    const rect = node.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    // Narrowed response curve: full deflection only near the edges, so the
    // center rests flat and the depth reads on deliberate movement.
    const rawX = (event.clientX - rect.left) / rect.width - 0.5
    const rawY = (event.clientY - rect.top) / rect.height - 0.5
    const x = Math.sign(rawX) * Math.pow(Math.abs(rawX) * 2, 1.4) / 2
    const y = Math.sign(rawY) * Math.pow(Math.abs(rawY) * 2, 1.4) / 2
    node.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(${lift}px)`
  }

  const reset = () => {
    if (ref.current) ref.current.style.transform = ''
  }

  return (
    <div ref={ref} className={`tilt${className ? ` ${className}` : ''}`} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
    </div>
  )
}
