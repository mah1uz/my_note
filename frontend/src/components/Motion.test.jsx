import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Reveal from './Reveal'
import Tilt from './Tilt'

describe('Reveal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reveals content through IntersectionObserver exactly once', async () => {
    let callback = null
    const unobserved = []
    vi.stubGlobal('IntersectionObserver', class {
      constructor(next) { callback = next }
      observe() {}
      unobserve(target) { unobserved.push(target) }
      disconnect() {}
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false }),
    })
    const { container } = render(<Reveal delay={80}><span>hello</span></Reveal>)
    const node = container.firstChild
    expect(node).not.toHaveClass('in')
    expect(node.style.getPropertyValue('--reveal-delay')).toBe('80ms')
    callback([{ isIntersecting: true, target: node }])
    expect(node).toHaveClass('in')
    expect(unobserved).toEqual([node])
  })

  it('shows content immediately when reduced motion is preferred', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: true }),
    })
    const { container } = render(<Reveal><span>hello</span></Reveal>)
    expect(container.firstChild).toHaveClass('in')
  })
})

describe('Tilt', () => {
  it('tilts subtly on pointer move and resets on leave', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false }),
    })
    const { container } = render(<Tilt max={3}><span>card</span></Tilt>)
    const node = container.firstChild
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 100 })
    await user.hover(node)
    expect(node.style.transform).toContain('perspective(900px)')
    const degrees = [...node.style.transform.matchAll(/(-?\d+\.?\d*)deg/g)].map((match) => Math.abs(Number(match[1])))
    for (const value of degrees) expect(value).toBeLessThanOrEqual(4)
    await user.unhover(node)
    expect(node.style.transform).toBe('')
  })
})
