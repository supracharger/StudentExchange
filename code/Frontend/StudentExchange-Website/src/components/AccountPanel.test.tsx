import { marketplace } from '../api/marketplace'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accounts, AccountApiError } from '../api/accounts'
import App from '../App'

const profile = {
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  school: 'University of Colorado Denver',
}

beforeEach(() => {
  vi.spyOn(marketplace, 'catalog').mockResolvedValue({
    categories: [],
    conditions: [],
  })
  vi.spyOn(marketplace, 'listings').mockResolvedValue({ listings: [] })

  vi.spyOn(accounts, 'profile').mockRejectedValue(
    new AccountApiError(401, 'Please log in to continue.'),
  )
  vi.spyOn(accounts, 'schools').mockResolvedValue({ schools: [profile.school] })
})

describe('account UI', () => {
  it('registers, logs in, submits only changed profile fields, and logs out', async () => {
    const register = vi.spyOn(accounts, 'register').mockResolvedValue({
      email: profile.email,
      message: 'Account created. You can now log in.',
    })
    const login = vi.spyOn(accounts, 'login').mockResolvedValue({ profile })
    const update = vi.spyOn(accounts, 'update').mockResolvedValue({
      profile: { ...profile, first_name: 'Alice' },
      message: 'Profile updated.',
    })
    const logout = vi
      .spyOn(accounts, 'logout')
      .mockResolvedValue({ message: 'Logged out.' })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Log in / Join' }))
    await user.click(
      await screen.findByRole('button', { name: 'Create account' }),
    )
    await user.type(screen.getByLabelText('First name'), profile.first_name)
    await user.type(screen.getByLabelText('Last name'), profile.last_name)
    await user.type(screen.getByLabelText('Email'), profile.email)
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'Fixture!123',
    )
    await user.selectOptions(screen.getByLabelText('School'), profile.school)
    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(register).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Confirm Password'), 'Fixture!124')
    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(register).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Passwords do not match.',
    )
    await user.clear(screen.getByLabelText('Confirm Password'))
    await user.type(screen.getByLabelText('Confirm Password'), 'Fixture!123')
    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(register).toHaveBeenCalledWith({
      ...profile,
      password: 'Fixture!123',
    })
    expect(
      await screen.findByText('Account created. You can now log in.'),
    ).toBeVisible()
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('')
    expect(login).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Confirm Password')).not.toBeInTheDocument()
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'Fixture!123',
    )
    await user.click(
      screen.getByRole('button', { name: 'Log in to your account' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Your account' }),
    ).toBeVisible()
    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), 'Alice')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(update).toHaveBeenCalledWith({ first_name: 'Alice' })
    expect(await screen.findByText('Profile updated.')).toBeVisible()
    expect(screen.getByLabelText('First name')).toHaveValue('Alice')
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(logout).toHaveBeenCalledOnce()
    expect(
      await screen.findByText('You have been logged out of all sessions.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Log in / Join' })).toBeVisible()
  })

  it('keeps login failures visible and clears the attempted password', async () => {
    vi.spyOn(accounts, 'login').mockRejectedValue(
      new AccountApiError(400, 'Incorrect email or password.'),
    )
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Log in / Join' }))
    await user.type(await screen.findByLabelText('Email'), profile.email)
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'Incorrect!123',
    )
    await user.click(
      screen.getByRole('button', { name: 'Log in to your account' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Incorrect email or password.',
    )
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('')
  })

  it('requires an exact confirmation for password changes and rechecks edits to either field', async () => {
    vi.mocked(accounts.profile).mockResolvedValue({ profile })
    const update = vi.spyOn(accounts, 'update').mockResolvedValue({
      profile,
      message: 'Profile updated.',
    })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'My account' }))
    const password = screen.getByLabelText('New password (optional)')
    const confirmation = screen.getByLabelText('Confirm Password')
    expect(confirmation).not.toBeRequired()
    await user.type(password, 'Changed!123')
    expect(confirmation).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(update).not.toHaveBeenCalled()
    await user.type(confirmation, 'changed!123')
    expect(confirmation).toHaveAttribute('aria-invalid', 'true')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(update).not.toHaveBeenCalled()
    await user.clear(confirmation)
    await user.type(confirmation, 'Changed!123')
    expect(confirmation).toBeValid()
    await user.type(password, '4')
    expect(confirmation).toBeInvalid()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(update).not.toHaveBeenCalled()
    await user.type(confirmation, '4')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(update).toHaveBeenCalledExactlyOnceWith({ password: 'Changed!1234' })
    expect(password).toHaveValue('')
    expect(confirmation).toHaveValue('')
  })

  it('clears both password fields after a failed registration and when switching forms', async () => {
    const register = vi
      .spyOn(accounts, 'register')
      .mockRejectedValue(new AccountApiError(400, 'Email already registered.'))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Log in / Join' }))
    await user.click(
      await screen.findByRole('button', { name: 'Create account' }),
    )
    await user.type(screen.getByLabelText('First name'), profile.first_name)
    await user.type(screen.getByLabelText('Last name'), profile.last_name)
    await user.type(screen.getByLabelText('Email'), profile.email)
    await user.selectOptions(screen.getByLabelText('School'), profile.school)
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'Fixture!123',
    )
    await user.type(screen.getByLabelText('Confirm Password'), 'Fixture!123')
    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(register).toHaveBeenCalledOnce()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email already registered.',
    )
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('')
    expect(screen.getByLabelText('Confirm Password')).toHaveValue('')
    await user.type(screen.getByLabelText('Confirm Password'), 'Another!123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByLabelText('Confirm Password')).toHaveValue('')
  })

  it('restores the session and returns to login when the service confirms expiry', async () => {
    vi.mocked(accounts.profile)
      .mockResolvedValueOnce({ profile })
      .mockRejectedValueOnce(new AccountApiError(401, 'Token has expired.'))
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'My account' }))
    await user.click(screen.getByRole('button', { name: 'Reload profile' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Token has expired.',
    )
    expect(
      screen.getByRole('button', { name: 'Log in to your account' }),
    ).toBeVisible()
  })

  it('makes school failures retryable and cannot submit registration without a school', async () => {
    vi.mocked(accounts.schools)
      .mockRejectedValueOnce(
        new AccountApiError(502, 'School service unavailable.'),
      )
      .mockResolvedValueOnce({ schools: [profile.school] })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Log in / Join' }))
    await user.click(
      await screen.findByRole('button', { name: 'Create account' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'School service unavailable.',
    )
    expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled()
    await user.click(
      screen.getByRole('button', { name: 'Retry school lookup' }),
    )
    await waitFor(() => expect(screen.getByLabelText('School')).toBeEnabled())
    expect(
      within(screen.getByLabelText('School')).getByRole('option', {
        name: profile.school,
      }),
    ).toBeVisible()
    await user.selectOptions(screen.getByLabelText('School'), profile.school)
    expect(screen.getByRole('button', { name: 'Register' })).toBeEnabled()
  })

  it('retains the account when logout is unavailable and restores keyboard focus when closed', async () => {
    vi.mocked(accounts.profile).mockResolvedValue({ profile })
    vi.spyOn(accounts, 'logout').mockRejectedValue(
      new AccountApiError(502, 'Please try logout again.'),
    )
    const user = userEvent.setup()
    render(<App />)
    const trigger = await screen.findByRole('button', { name: 'My account' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please try logout again.',
    )
    expect(screen.getByRole('heading', { name: 'Your account' })).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Close account panel' }),
    )
    expect(trigger).toHaveFocus()
  })
})
