import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import QueueProgress, { phaseFor } from './QueueProgress'

describe('QueueProgress', () => {
  it('maps statuses to honest approximate phases', () => {
    expect(phaseFor('UNPROCESSED')).toMatchObject({ width: 12, label: 'Queued' })
    expect(phaseFor('PROCESSING').width).toBeGreaterThan(phaseFor('UNPROCESSED').width)
    expect(phaseFor('FAILED')).toMatchObject({ width: 100, label: 'Needs a retry' })
    expect(phaseFor('REVIEW_REQUIRED')).toMatchObject({ width: 100 })
    expect(phaseFor('PROCESSED')).toMatchObject({ width: 100, label: 'Done' })
    expect(phaseFor('SOMETHING_ELSE')).toMatchObject({ width: 12 })
  })

  it('renders a labelled approximate bar per status', () => {
    const { rerender } = render(<QueueProgress status="PROCESSING" />)
    const bar = screen.getByRole('img', { name: /analyzing.*approximate/i })
    expect(bar.querySelector('.queue-bar > span').style.width).toBe('65%')
    expect(screen.getByText('approx.')).toBeInTheDocument()
    rerender(<QueueProgress status="FAILED" />)
    expect(screen.getByRole('img', { name: /needs a retry.*approximate/i })).toBeInTheDocument()
  })
})
