import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminPage from './AdminPage'
import AccountPanel from './AccountPanel'
import App from '../App'
import { admin } from '../api/admin'
import type { AdminAccess } from '../api/admin'
import { accounts, AccountApiError } from '../api/accounts'
import type { AccountState } from '../hooks/useAccount'

const profile = {
  email: 'admin@example.com',
  first_name: 'Ada',
  last_name: 'Admin',
  school: 'Campus',
}
const student = {
  email: 'sam@example.com',
  first_name: 'Sam',
  last_name: 'Student',
  school: 'Campus',
}
function access(level: number, isAdmin = true): AdminAccess {
  return {
    is_admin: isAdmin,
    level: isAdmin ? level : null,
    permissions: {
      schools: isAdmin && level >= 10,
      users: isAdmin && level >= 10,
      profiles: isAdmin && level >= 10,
      deleteUsers: isAdmin && level >= 10,
      blocked: isAdmin && level >= 20,
      endSessions: isAdmin,
    },
  }
}
function account(): AccountState {
  return {
    profile,
    restoring: false,
    busy: false,
    error: '',
    notice: '',
    clearMessages: vi.fn(),
    expire: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    update: vi.fn(),
    reload: vi.fn(),
    logout: vi.fn(),
  }
}
function renderPage(level = 20, membership = true) {
  const state = account()
  const refresh = vi.fn()
  const result = render(
    <AdminPage
      account={state}
      administration={{
        access: access(level, membership),
        error: '',
        loading: false,
        refresh,
      }}
      onLogin={vi.fn()}
      onBack={vi.fn()}
    />,
  )
  return { ...result, state, refresh }
}
beforeEach(() => {
  // jsdom has no native modal implementation; this shim makes role/query and interaction tests possible.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    },
  })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.history.replaceState(null, '', '/')
  vi.spyOn(admin, 'access').mockResolvedValue(access(20))
  vi.spyOn(admin, 'schools').mockResolvedValue({ schools: [{ name: 'Campus', short_name: 'C' }] })
  vi.spyOn(admin, 'addSchool').mockResolvedValue({ message: 'School added.' })
  vi.spyOn(admin, 'deleteSchool').mockResolvedValue({ message: 'School deleted.' })
  vi.spyOn(admin, 'users').mockResolvedValue({
    users: [
      {
        email: student.email,
        name: 'Student, Sam',
        school: 'Campus',
        datetime: '2026-10-09T12:00:00',
      },
      {
        email: 'senior@example.com',
        name: 'Senior, Admin',
        school: 'Another Campus',
        datetime: '2026-10-08T12:00:00',
      },
    ],
  })
  vi.spyOn(admin, 'blocked').mockResolvedValue({
    blockedUsers: [
      {
        email: student.email,
        name: 'Student, Sam',
        expiry: '2026-10-09T12:05:00',
        count: 10,
      },
    ],
    blockedIPs: [
      {
        email: student.email,
        name: 'Student, Sam',
        ip: '192.0.2.3',
        expiry: '2026-10-09T12:05:00',
        count: 3,
      },
    ],
  })
  vi.spyOn(admin, 'profile').mockImplementation(async (email) => {
    if (email === 'senior@example.com')
      throw new AccountApiError(403, 'Not permitted.')
    return { profile: student }
  })
  vi.spyOn(admin, 'deleteUser').mockResolvedValue({
    message: 'Account deleted.',
  })
  vi.spyOn(admin, 'endSessions').mockResolvedValue({
    message: 'All sessions ended for this user.',
  })
  vi.spyOn(admin, 'clearAttempts').mockResolvedValue({
    message: 'Attempt records cleared.',
  })
  vi.spyOn(admin, 'update').mockResolvedValue({
    profile: student,
    message: 'Profile updated.',
  })
  vi.spyOn(accounts, 'schools').mockResolvedValue({
    schools: ['Campus', 'Another Campus'],
  })
})

describe('admin interface', () => {
  it('hides navigation and avoids unauthorized API calls at levels 0 and 10', async () => {
    const user = userEvent.setup()
    const first = renderPage(0)
    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Ada.' }),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        screen.queryByText('Loading your workspace…'),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', { name: /^Users/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Login attempts/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Schools' })).not.toBeInTheDocument()
    expect(admin.schools).not.toHaveBeenCalled()
    expect(admin.users).not.toHaveBeenCalled()
    expect(admin.blocked).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'End user sessions' }))
    expect(screen.getByRole('textbox', { name: 'Account email' })).toBeVisible()
    first.unmount()
    renderPage(10)
    await waitFor(() => expect(admin.users).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /^Users/ })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Login attempts/ }),
    ).not.toBeInTheDocument()
    expect(admin.blocked).not.toHaveBeenCalled()
  })
  it.each([1, 2, 9])('hides level-10 and level-20 tools at admin level %i', async (level) => {
    renderPage(level)
    await waitFor(() =>
      expect(screen.queryByText('Loading your workspace…')).not.toBeInTheDocument(),
    )
    for (const name of [/^Users/, /^Schools$/, /Login attempts/])
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    expect(admin.users).not.toHaveBeenCalled()
    expect(admin.schools).not.toHaveBeenCalled()
    expect(admin.blocked).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'End user sessions' })).toBeVisible()
  })
  it('keeps level-10 tools available at level 19 while hiding level-20 tools', async () => {
    renderPage(19)
    await waitFor(() => expect(admin.users).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /^Users/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Schools' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Login attempts/ })).not.toBeInTheDocument()
    expect(admin.blocked).not.toHaveBeenCalled()
  })
  it('adds schools and requires confirmation before deleting the selected name and short name', async () => {
    const user = userEvent.setup()
    renderPage(10)
    await waitFor(() => expect(screen.queryByText('Loading your workspace…')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Schools' }))
    expect(await screen.findByRole('button', { name: 'Delete school Campus' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add school' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'School name' }), 'New Campus')
    await user.type(screen.getByRole('textbox', { name: 'Short name' }), 'NC')
    await user.click(screen.getByRole('button', { name: 'Add school' }))
    await waitFor(() => expect(admin.addSchool).toHaveBeenCalledWith({ name: 'New Campus', short_name: 'NC' }))
    expect(await screen.findByRole('status')).toHaveTextContent('School added.')
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'School name' })).toHaveValue(''))
    await user.click(await screen.findByRole('button', { name: 'Delete school Campus' }))
    expect(admin.deleteSchool).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(admin.deleteSchool).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Delete school Campus' }))
    await user.click(screen.getByRole('button', { name: 'Delete school' }))
    await waitFor(() => expect(admin.deleteSchool).toHaveBeenCalledWith({ name: 'Campus', short_name: 'C' }))
    expect(await screen.findByRole('status')).toHaveTextContent('School deleted.')
  })
  it('keeps school form values after failure and shows list errors with a retry', async () => {
    const user = userEvent.setup()
    vi.mocked(admin.schools).mockRejectedValueOnce(new AccountApiError(502, 'School list unavailable.'))
    vi.mocked(admin.addSchool).mockRejectedValueOnce(new AccountApiError(400, 'School already exists.'))
    renderPage(10)
    await waitFor(() => expect(screen.queryByText('Loading your workspace…')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Schools' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('School list unavailable.')
    await user.click(screen.getByRole('button', { name: 'Retry school list' }))
    expect(await screen.findByRole('button', { name: 'Delete school Campus' })).toBeVisible()
    await user.type(screen.getByRole('textbox', { name: 'School name' }), 'Campus')
    await user.type(screen.getByRole('textbox', { name: 'Short name' }), 'C')
    await user.click(screen.getByRole('button', { name: 'Add school' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('School already exists.')
    expect(screen.getByRole('textbox', { name: 'School name' })).toHaveValue('Campus')
  })
  it('hides profile, session, and deletion controls for a forbidden forwarded target', async () => {
    const user = userEvent.setup()
    renderPage(10)
    await waitFor(() =>
      expect(
        screen.queryByText('Loading your workspace…'),
      ).not.toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /^Users/ }))
    expect(
      await screen.findByRole('button', { name: `Manage ${student.email}` }),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        screen.queryByText('Checking profile access for these users…'),
      ).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('button', { name: 'Manage senior@example.com' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete senior@example.com' }),
    ).not.toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), 'ANOTHER campus')
    expect(screen.queryByText(student.email)).not.toBeInTheDocument()
    expect(screen.getByText('senior@example.com')).toBeVisible()
  })
  it('requires typed confirmation before permanent deletion and does not mutate on cancel', async () => {
    const user = userEvent.setup()
    renderPage(10)
    await waitFor(() =>
      expect(
        screen.queryByText('Loading your workspace…'),
      ).not.toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /^Users/ }))
    await user.click(
      await screen.findByRole('button', { name: `Delete ${student.email}` }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete this account?' })
    expect(
      within(dialog).getByRole('button', { name: 'Delete account' }),
    ).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(admin.deleteUser).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: `Delete ${student.email}` }),
    )
    await user.type(screen.getByRole('textbox'), student.email)
    await user.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() =>
      expect(admin.deleteUser).toHaveBeenCalledWith(student.email),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Account deleted.',
    )
  })
  it('edits only changed profile fields and can end all target sessions with confirmation', async () => {
    const user = userEvent.setup()
    renderPage(10)
    await waitFor(() =>
      expect(
        screen.queryByText('Loading your workspace…'),
      ).not.toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /^Users/ }))
    await user.click(
      await screen.findByRole('button', { name: `Manage ${student.email}` }),
    )
    render(<AccountPanel account={account()} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Manage student' })
    expect(within(dialog).getByLabelText('School')).toHaveAttribute(
      'id',
      'admin-account-school',
    )
    expect(within(dialog).getByLabelText('Confirm Password')).toHaveAttribute(
      'id',
      'admin-confirm-password',
    )
    const firstName = within(dialog).getByRole('textbox', {
      name: 'First name',
    })
    await user.clear(firstName)
    await user.type(firstName, 'Alice')
    await user.click(
      within(dialog).getByRole('button', { name: 'Save changes' }),
    )
    await waitFor(() =>
      expect(admin.update).toHaveBeenCalledWith(student.email, {
        first_name: 'Alice',
      }),
    )
    await user.click(
      await screen.findByRole('button', { name: `Manage ${student.email}` }),
    )
    await user.click(screen.getByRole('button', { name: 'End sessions…' }))
    expect(admin.endSessions).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'End all sessions' }))
    await waitFor(() =>
      expect(admin.endSessions).toHaveBeenCalledWith(student.email),
    )
  })
  it('clears IP and user records separately and labels the records as attempts', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() =>
      expect(
        screen.queryByText('Loading your workspace…'),
      ).not.toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /Login attempts/ }))
    expect(
      screen.getByText(/Includes attempts below the block threshold/),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'IP addresses 1' }))
    await user.click(
      screen.getByRole('button', { name: 'Clear records for 192.0.2.3' }),
    )
    await user.click(screen.getByRole('button', { name: 'Clear records' }))
    await waitFor(() =>
      expect(admin.clearAttempts).toHaveBeenCalledWith({
        ip_addr: '192.0.2.3',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Users 1' }))
    await user.click(
      screen.getByRole('button', {
        name: `Clear records for ${student.email}`,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Clear records' }))
    await waitFor(() =>
      expect(admin.clearAttempts).toHaveBeenCalledWith({
        email: student.email,
      }),
    )
  })
  it('guards direct access for regular users and signed-out visitors', async () => {
    const first = renderPage(20, false)
    expect(
      screen.getByRole('heading', { name: 'Administrator access required' }),
    ).toBeVisible()
    expect(admin.users).not.toHaveBeenCalled()
    first.unmount()
    const state = account()
    state.profile = null
    render(
      <AdminPage
        account={state}
        administration={{
          access: null,
          error: '',
          loading: false,
          refresh: vi.fn(),
        }}
        onLogin={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Log in' })).toBeVisible()
  })
  it('adds the admin link after restoring an admin session and handles browser navigation', async () => {
    vi.spyOn(accounts, 'profile').mockResolvedValue({ profile })
    const user = userEvent.setup()
    render(<App />)
    const link = await screen.findByRole('link', { name: 'Admin console' })
    await user.click(link)
    expect(window.location.pathname).toBe('/admin')
    expect(
      screen.getByRole('heading', { name: 'Welcome back, Ada.' }),
    ).toBeVisible()
    await user.click(
      screen.getByRole('link', { name: 'Student Exchange home' }),
    )
    expect(window.location.pathname).toBe('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'semester’s essentials',
    )
  })
  it('does not add an admin link for regular sessions', async () => {
    vi.spyOn(accounts, 'profile').mockResolvedValue({ profile })
    vi.mocked(admin.access).mockResolvedValue(access(0, false))
    render(<App />)
    await waitFor(() => expect(admin.access).toHaveBeenCalled())
    expect(
      screen.queryByRole('link', { name: /Admin console/ }),
    ).not.toBeInTheDocument()
  })
})
