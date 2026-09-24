import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GoogleSignInButton from './GoogleSignInButton'
import { signInWithGoogle } from '../api/authApi'

vi.mock('../api/authApi', () => ({ signInWithGoogle: vi.fn() }))
vi.mock('../api/supabaseClient', () => ({ isSupabaseConfigured: true }))

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    vi.mocked(signInWithGoogle).mockReset()
    vi.mocked(signInWithGoogle).mockResolvedValue(undefined)
  })

  it('shows the Google logo beside the generic label and starts sign-in', async () => {
    const user = userEvent.setup()
    render(<GoogleSignInButton />)
    const button = screen.getByRole('button', { name: /continue with google/i })
    expect(button.querySelector('svg.google-logo')).toBeInTheDocument()
    await user.click(button)
    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('button', { name: /opening google/i })).toBeInTheDocument()
  })
})
