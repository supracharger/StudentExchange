import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { admin } from '../api/admin'
import SchoolsPanel from './SchoolsPanel'
import AdminAccessPanel from './AdminAccessPanel'
import type {
  AdminAccess,
  AdminUser,
  AttemptRecord,
  IPAttemptRecord,
  Attempts,
} from '../api/admin'
import { AccountApiError } from '../api/accounts'
import type { Profile, ProfileUpdate } from '../api/accounts'
import type { AccountState } from '../hooks/useAccount'
import type { useAdmin } from '../hooks/useAdmin'
import {
  SchoolSelect,
  PasswordField,
  ConfirmPasswordField,
} from './AccountPanel'

type Section = 'overview' | 'users' | 'blocked' | 'sessions' | 'schools' | 'adminAccess'
type Confirmation = {
  title: string
  description: string
  label: string
  danger?: boolean
  email?: string
  run: () => Promise<{ message: string }>
}
const PAGE_SIZE = 8
const message = (reason: unknown) =>
  reason instanceof Error
    ? reason.message
    : 'Unable to complete this request. Please try again.'

// Backend timestamps have no offset and are Mountain local time. Do not parse them as browser-local dates.
function Timestamp({ value }: { value: string }) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return (
    <time dateTime={value}>
      {match
        ? `${months[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]} · ${match[4]}:${match[5]}`
        : value}
    </time>
  )
}

export default function AdminPage({
  account,
  administration,
  onLogin,
  onBack,
}: {
  account: AccountState
  administration: ReturnType<typeof useAdmin>
  onLogin: () => void
  onBack: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const access = administration.access
  if (account.restoring || administration.loading)
    return (
      <section className="admin-gate" aria-busy="true">
        <p role="status">Checking administrator access…</p>
      </section>
    )
  if (!account.profile)
    return (
      <section className="admin-gate">
        <p className="eyebrow">STUDENT EXCHANGE / ADMINISTRATION</p>
        <h1 ref={heading} tabIndex={-1}>
          Log in to continue
        </h1>
        <p>Sign in with your administrator account to open the console.</p>
        <button className="button-primary" onClick={onLogin}>
          Log in
        </button>
      </section>
    )
  if (administration.error)
    return (
      <section className="admin-gate">
        <h1>Access check unavailable</h1>
        <p role="alert">{administration.error}</p>
        <button className="button-primary" onClick={administration.refresh}>
          Retry access check
        </button>
      </section>
    )
  if (!access?.is_admin)
    return (
      <section className="admin-gate">
        <h1 ref={heading} tabIndex={-1}>
          Administrator access required
        </h1>
        <p>This account does not have access to the admin console.</p>
        <button className="button-primary" onClick={onBack}>
          Back to the exchange
        </button>
      </section>
    )
  return (
    <Console
      key={account.profile.email}
      account={account}
      access={access}
      refreshAccess={administration.refresh}
      onBack={onBack}
    />
  )
}

function Console({
  account,
  access,
  refreshAccess,
  onBack,
}: {
  account: AccountState
  access: AdminAccess
  refreshAccess: () => void
  onBack: () => void
}) {
  const [section, setSection] = useState<Section>('overview')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [attempts, setAttempts] = useState<Attempts>({
    blockedUsers: [],
    blockedIPs: [],
  })
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [school, setSchool] = useState('')
  const [page, setPage] = useState(1)
  const [recordType, setRecordType] = useState<'users' | 'ips'>('users')
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({})
  const [checking, setChecking] = useState(false)
  const [selected, setSelected] = useState<Profile | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [busy, setBusy] = useState(false)
  const [targetEmail, setTargetEmail] = useState('')
  const [adminTarget, setAdminTarget] = useState<AdminUser | null>(null)
  const permissions = access.permissions
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    heading.current?.focus()
    const previousTitle = document.title
    document.title = 'Admin console | Student Exchange'
    return () => {
      document.title = previousTitle
    }
  }, [])

  function handleError(reason: unknown) {
    setError(message(reason))
    if (reason instanceof AccountApiError && reason.status === 401)
      account.expire()
    if (reason instanceof AccountApiError && reason.status === 403) {
      setProfiles({})
      // A target restriction should remain visible; a caller demotion should rebuild the UI.
      admin
        .access()
        .then((current) => {
          if (
            current.is_admin !== access.is_admin ||
            current.level !== access.level
          )
            refreshAccess()
        })
        .catch(() => {
          /* Keep the original action error and retry control. */
        })
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setProfiles({})
    setLoaded(false)
    Promise.all([
      permissions.users
        ? admin.users(controller.signal)
        : Promise.resolve({ users: [] }),
      permissions.blocked
        ? admin.blocked(controller.signal)
        : Promise.resolve({ blockedUsers: [], blockedIPs: [] }),
    ])
      .then(([directory, records]) => {
        if (!controller.signal.aborted) {
          setUsers(directory.users)
          setAttempts(records)
          setLoaded(true)
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) handleError(reason)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [revision, access])

  const filteredUsers = users.filter(
    (user) =>
      (!school || user.school === school) &&
      `${user.name} ${user.email} ${user.school}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  )
  const sourceRecords =
    recordType === 'users' ? attempts.blockedUsers : attempts.blockedIPs
  const filteredRecords = sourceRecords.filter((record) =>
    ('ip' in record
      ? `${record.ip} ${record.users.map(user => `${user.name} ${user.email}`).join(' ')}`
      : `${record.name} ${record.email}`)
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  )
  const total =
    section === 'blocked' ? filteredRecords.length : filteredUsers.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const pageUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const pageRecords = filteredRecords.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const emailsKey =
    section === 'users' && loaded
      ? JSON.stringify(pageUsers.map((user) => user.email))
      : '[]'
  useEffect(() => {
    const emails: string[] = JSON.parse(emailsKey)
    if (!emails.length || !permissions.profiles) return
    const controller = new AbortController()
    setChecking(true)
    // Check only the visible page, with bounded concurrency, before rendering profile/session actions.
    const check = async () => {
      const results: Record<string, Profile | null> = {}
      let index = 0
      let firstError: unknown
      await Promise.all(
        Array.from({ length: Math.min(3, emails.length) }, async () => {
          while (index < emails.length && !controller.signal.aborted) {
            const email = emails[index++]
            try {
              results[email] = (
                await admin.profile(email, controller.signal)
              ).profile
            } catch (reason) {
              if (controller.signal.aborted) return
              if (reason instanceof AccountApiError && reason.status === 403)
                results[email] = null
              else {
                results[email] = null
                firstError ??= reason
              }
            }
          }
        }),
      )
      if (!controller.signal.aborted) {
        setProfiles((current) => ({ ...current, ...results }))
        if (firstError) handleError(firstError)
      }
    }
    check()
      .catch((reason) => {
        if (!controller.signal.aborted) handleError(reason)
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false)
      })
    return () => controller.abort()
  }, [emailsKey, revision, permissions.profiles])

  function go(next: Section) {
    setSection(next)
    setQuery('')
    setSchool('')
    setPage(1)
    setError('')
    setSelected(null)
    queueMicrotask(() => heading.current?.focus())
  }
  function askDelete(email: string) {
    setConfirmation({
      title: 'Delete this account?',
      description: `This permanently deletes ${email}. This action cannot be undone.`,
      label: 'Delete account',
      danger: true,
      email,
      run: () => admin.deleteUser(email),
    })
  }
  function askEndSessions(email: string) {
    setConfirmation({
      title: 'End all sessions?',
      description: `${email} will be signed out on every device and will need to log in again.`,
      label: 'End all sessions',
      run: () => admin.endSessions(email),
    })
  }
  function askClear(record: AttemptRecord | IPAttemptRecord) {
    const selector = 'ip' in record
      ? { ip_addr: record.ip }
      : { email: record.email }
    setConfirmation({
      title: 'Clear attempt records?',
      description: `Remove all login-attempt records for ${'ip' in record ? record.ip : record.email}. User and IP records are cleared separately. Previously revoked sessions stay revoked.`,
      label: 'Clear records',
      run: () => admin.clearAttempts(selector),
    })
  }
  async function confirm() {
    if (!confirmation || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await confirmation.run()
      setNotice(result.message)
      setConfirmation(null)
      setSelected(null)
      setAdminTarget(null)
      setRevision((value) => value + 1)
    } catch (reason) {
      handleError(reason)
    } finally {
      setBusy(false)
    }
  }
  const sections: {
    id: Section
    icon: string
    label: string
    visible: boolean
  }[] = [
    { id: 'overview', icon: '◈', label: 'Overview', visible: true },
    { id: 'adminAccess', icon: '◇', label: 'Admin access', visible: permissions.manageAdmins },
    { id: 'schools', icon: '▤', label: 'Schools', visible: permissions.schools },
    { id: 'users', icon: '♧', label: 'Users', visible: permissions.users },
    {
      id: 'blocked',
      icon: '◎',
      label: 'Login attempts',
      visible: permissions.blocked,
    },
    {
      id: 'sessions',
      icon: '↪',
      label: 'End user sessions',
      visible: permissions.endSessions && !permissions.profiles,
    },
  ]
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-symbol" aria-hidden="true">
            ◈
          </span>
          <strong>
            Admin console<small>STUDENT EXCHANGE</small>
          </strong>
        </div>
        <p className="admin-nav-label">WORKSPACE</p>
        <nav aria-label="Administration">
          {sections
            .filter((item) => item.visible)
            .map((item) => (
              <button
                key={item.id}
                aria-current={section === item.id ? 'page' : undefined}
                onClick={() => go(item.id)}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
                {item.id === 'users' && loaded && <small>{users.length}</small>}
              </button>
            ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-access-badge">
            <span aria-hidden="true">●</span> Administrator · Level{' '}
            {access.level}
          </div>
          <p>{account.profile?.email}</p>
          <button onClick={onBack}>← Back to the exchange</button>
        </div>
      </aside>
      <section className="admin-content" aria-labelledby="admin-title">
        <div className="admin-topline">
          <span>
            Workspace <span aria-hidden="true">/</span>{' '}
            {sections.find((item) => item.id === section)?.label}
          </span>
          <button
            className="admin-button subtle"
            disabled={loading || busy}
            onClick={() => {
              setSelected(null)
              setRevision((value) => value + 1)
            }}
          >
            ↻ Refresh
          </button>
        </div>
        <header className="admin-page-heading">
          <p className="eyebrow">YOUR CAMPUS. IN GOOD HANDS.</p>
          <h1 id="admin-title" ref={heading} tabIndex={-1}>
            {section === 'overview'
              ? `Welcome back, ${account.profile?.first_name}.`
              : section === 'adminAccess'
                ? 'Manage admin access'
                : section === 'schools'
                ? 'Manage schools'
                : section === 'users'
                  ? 'Your student community'
                  : section === 'blocked'
                    ? 'Login attempts'
                    : 'End user sessions'}
          </h1>
          <p>
            {section === 'overview'
              ? 'A clear view of your community, with the tools to keep it running smoothly.'
              : section === 'adminAccess'
                ? 'Grant, change, or remove admin access for eligible users.'
                : section === 'schools'
                ? 'Keep the school list available to students up to date.'
                : section === 'users'
                  ? 'Find students, keep profiles up to date, and manage account access.'
                  : section === 'blocked'
                    ? 'Review user and IP attempt records and help students regain access.'
                    : 'Sign an eligible user out of all active sessions.'}
          </p>
        </header>
        {error && (
          <div className="admin-alert error" role="alert">
            {error}{' '}
            {!confirmation && (
              <button onClick={() => setRevision((value) => value + 1)}>
                Try again
              </button>
            )}
          </div>
        )}
        {notice && (
          <div className="admin-alert success" role="status">
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice('')}
            >
              ×
            </button>
          </div>
        )}
        {loading ? (
          <div className="admin-loading" role="status">
            <span className="admin-spinner" />
            Loading your workspace…
          </div>
        ) : (
          <>
            {section === 'overview' && (
              <>
                <div className="admin-stats">
                  {permissions.users && (
                    <button onClick={() => go('users')}>
                      <span>COMMUNITY</span>
                      <strong>{loaded ? users.length : '—'}</strong>
                      <small>
                        Registered students <span aria-hidden="true">↗</span>
                      </small>
                    </button>
                  )}
                  {permissions.blocked && (
                    <>
                      <button
                        onClick={() => {
                          go('blocked')
                          setRecordType('users')
                        }}
                      >
                        <span>USER ATTEMPTS</span>
                        <strong>
                          {loaded ? attempts.blockedUsers.length : '—'}
                        </strong>
                        <small>
                          User records <span aria-hidden="true">↗</span>
                        </small>
                      </button>
                      <button
                        onClick={() => {
                          go('blocked')
                          setRecordType('ips')
                        }}
                      >
                        <span>NETWORK ATTEMPTS</span>
                        <strong>
                          {loaded
                            ? new Set(attempts.blockedIPs.map((row) => row.ip))
                                .size
                            : '—'}
                        </strong>
                        <small>
                          IP addresses with records{' '}
                          <span aria-hidden="true">↗</span>
                        </small>
                      </button>
                    </>
                  )}
                </div>
                <div className="admin-overview-grid">
                  <div className="admin-card">
                    <div className="admin-card-heading">
                      <h2>Make yourself at home</h2>
                      <span aria-hidden="true">↗</span>
                    </div>
                    <p>
                      Your workspace brings the community tools you can use into
                      one place.
                    </p>
                    {permissions.users && (
                      <button
                        className="admin-shortcut"
                        onClick={() => go('users')}
                      >
                        <span
                          className="admin-shortcut-icon"
                          aria-hidden="true"
                        >
                          ♧
                        </span>
                        <span>
                          <strong>Manage your community</strong>
                          <small>
                            Search students and manage their accounts
                          </small>
                        </span>
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                    {permissions.blocked && (
                      <button
                        className="admin-shortcut"
                        onClick={() => go('blocked')}
                      >
                        <span
                          className="admin-shortcut-icon"
                          aria-hidden="true"
                        >
                          ◎
                        </span>
                        <span>
                          <strong>Review login attempts</strong>
                          <small>Clear user or IP attempt records</small>
                        </span>
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                    {permissions.endSessions && !permissions.profiles && (
                      <button
                        className="admin-shortcut"
                        onClick={() => go('sessions')}
                      >
                        <span>
                          <strong>End user sessions</strong>
                          <small>
                            Sign an eligible user out on all devices
                          </small>
                        </span>
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                  </div>
                  <div className="admin-card admin-access-card">
                    <span className="admin-symbol" aria-hidden="true">
                      ◈
                    </span>
                    <h2>Your administrator access</h2>
                    <span className="admin-pill">Level {access.level}</span>
                    <p>
                      Signed in as <strong>{account.profile?.email}</strong>
                    </p>
                    <ul>
                      {permissions.users && (
                        <li>User directory and eligible profiles</li>
                      )}
                      {permissions.deleteUsers && <li>Account deletion</li>}
                      {permissions.schools && <li>Add and delete schools</li>}
                      {permissions.manageAdmins && <li>Manage lower-ranked admin access</li>}
                      {permissions.lockAdmins && <li>View admin levels and change locked status</li>}
                      {permissions.blocked && (
                        <li>User and IP attempt records</li>
                      )}
                      {permissions.endSessions && (
                        <li>End eligible user sessions</li>
                      )}
                    </ul>
                    <button
                      className="admin-button subtle"
                      onClick={refreshAccess}
                    >
                      Recheck my access
                    </button>
                  </div>
                </div>
                {permissions.users && (
                  <div className="admin-card">
                    <div className="admin-card-heading">
                      <h2>Recently joined</h2>
                      <button
                        className="admin-text-button"
                        onClick={() => go('users')}
                      >
                        View all users →
                      </button>
                    </div>
                    {loaded && users.length === 0 ? (
                      <Empty
                        title="Your community starts here"
                        description="Registered students will appear here as they join."
                      />
                    ) : (
                      <ul className="admin-recent">
                        {users.slice(0, 4).map((user) => (
                          <li key={user.email}>
                            <Avatar name={user.name} />
                            <span>
                              <strong>{user.name}</strong>
                              <small>{user.school}</small>
                            </span>
                            <Timestamp value={user.datetime} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
            {section === 'users' && permissions.users && (
              <div className="admin-card admin-directory">
                <div className="admin-card-heading">
                  <h2>
                    All users{' '}
                    <span className="admin-count">{users.length}</span>
                  </h2>
                  <span className="admin-caption">Newest first</span>
                </div>
                <div className="admin-filters">
                  <Search
                    value={query}
                    onChange={(value) => {
                      setQuery(value)
                      setPage(1)
                    }}
                    placeholder="Search name, email, or school…"
                  />
                  <label className="admin-school-filter">
                    <span className="sr-only">Filter users by school</span>
                    <select
                      value={school}
                      onChange={(event) => {
                        setSchool(event.target.value)
                        setPage(1)
                      }}
                    >
                      <option value="">All schools</option>
                      {[...new Set(users.map((user) => user.school))]
                        .sort()
                        .map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                    </select>
                  </label>
                </div>
                {checking && (
                  <p className="admin-caption" role="status">
                    Checking profile access for these users…
                  </p>
                )}
                {filteredUsers.length === 0 ? (
                  <Empty
                    title={
                      users.length
                        ? 'No matching students'
                        : 'No registered students yet'
                    }
                    description="Try a different search or school filter."
                    clear={() => {
                      setQuery('')
                      setSchool('')
                    }}
                  />
                ) : (
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <caption className="sr-only">
                        Student directory. Registration timestamps are Mountain
                        time.
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Student</th>
                          <th scope="col">School</th>
                          <th scope="col">Admin access</th>
                          <th scope="col">Joined · Mountain time</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageUsers.map((user) => (
                          <tr key={user.email}>
                            <td>
                              <div className="admin-person">
                                <Avatar name={user.name} />
                                <span>
                                  <strong>{user.name}</strong>
                                  <small>{user.email}</small>
                                </span>
                              </div>
                            </td>
                            <td>{user.school}</td>
                            <td>
                              <strong>{user.isAdmin ? 'Admin' : 'Student'}</strong>
                              {user.isAdmin && user.locked && <small>Locked</small>}
                              {permissions.viewAdminLevels && user.level != null && <small>Level {user.level}</small>}
                            </td>
                            <td>
                              <Timestamp value={user.datetime} />
                            </td>
                            <td>
                              <div className="admin-row-actions">
                                {permissions.profiles &&
                                  profiles[user.email] && (
                                    <button
                                      className="admin-button"
                                      onClick={() =>
                                        setSelected(profiles[user.email])
                                      }
                                      aria-label={`Manage ${user.email}`}
                                    >
                                      Manage <span aria-hidden="true">↗</span>
                                    </button>
                                  )}
                                {permissions.manageAdmins && profiles[user.email] &&
                                  user.email !== account.profile?.email &&
                                  (!user.locked || permissions.lockAdmins) &&
                                  (user.level == null || user.level < (access.level ?? 0)) && (
                                    <button className="admin-button" aria-label={`Admin access for ${user.email}`} onClick={() => {
                                      setAdminTarget(user)
                                      go('adminAccess')
                                    }}>Admin access…</button>
                                  )}
                                {permissions.deleteUsers &&
                                  profiles[user.email] && (
                                    <button
                                      className="admin-icon-button danger"
                                      onClick={() => askDelete(user.email)}
                                      aria-label={`Delete ${user.email}`}
                                      title="Delete account"
                                    >
                                      <Trash />
                                    </button>
                                  )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination
                  page={currentPage}
                  pages={pages}
                  total={total}
                  setPage={setPage}
                />
              </div>
            )}
            {section === 'blocked' && permissions.blocked && (
              <div className="admin-card">
                <div className="admin-card-heading">
                  <h2>Attempt records</h2>
                  <span className="admin-caption">Mountain time</span>
                </div>
                <p className="admin-record-note">
                  Successful access records are labeled Successful. Includes
                  attempts below the block threshold and
                  expired records awaiting cleanup. Each IP row lists its
                  associated users.
                </p>
                <div
                  className="admin-record-tabs"
                  role="group"
                  aria-label="Attempt record type"
                >
                  <button
                    aria-pressed={recordType === 'users'}
                    onClick={() => {
                      setRecordType('users')
                      setPage(1)
                      setQuery('')
                    }}
                  >
                    Users <span>{attempts.blockedUsers.length}</span>
                  </button>
                  <button
                    aria-pressed={recordType === 'ips'}
                    onClick={() => {
                      setRecordType('ips')
                      setPage(1)
                      setQuery('')
                    }}
                  >
                    IP addresses <span>{attempts.blockedIPs.length}</span>
                  </button>
                </div>
                <Search
                  value={query}
                  onChange={(value) => {
                    setQuery(value)
                    setPage(1)
                  }}
                  placeholder="Search email, name, or IP address…"
                />
                {filteredRecords.length === 0 ? (
                  <Empty
                    title={query ? 'No matching records' : 'No attempt records'}
                    description={
                      query
                        ? 'Try another name, email, or IP address.'
                        : 'There are no records to review in this category.'
                    }
                    clear={query ? () => setQuery('') : undefined}
                  />
                ) : (
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <caption className="sr-only">
                        {recordType === 'ips' ? 'IP' : 'User'} login attempt
                        records
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">
                            {recordType === 'ips'
                              ? 'IP address / student'
                              : 'Student'}
                          </th>
                          <th scope="col">Result / failed attempts</th>
                          <th scope="col">Expires · Mountain time</th>
                          <th scope="col">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRecords.map((record, index) => (
                          <tr key={`${'ip' in record ? record.ip : record.email}-${index}`}>
                            <td>
                              {'ip' in record ? (
                                <>
                                  <strong>{record.ip}</strong>
                                  {record.users.length ? record.users.map((user, index) => (
                                    <small key={`${user.email}-${index}`}>
                                      {user.name} · {user.email}
                                    </small>
                                  )) : <small>No associated users</small>}
                                </>
                              ) : (
                                <><strong>{record.name}</strong><small>{record.email}</small></>
                              )}
                            </td>
                            <td>
                              <span
                                className={`admin-pill ${record.count === -1 ? '' : 'amber'}`}
                              >
                                {record.count === -1 ? 'Successful' : `${record.count} failed attempts`}
                              </span>
                            </td>
                            <td>
                              <Timestamp value={record.expiry} />
                            </td>
                            <td>
                              <button
                                className="admin-button"
                                onClick={() => askClear(record)}
                                aria-label={`Clear records for ${'ip' in record ? record.ip : record.email}`}
                              >
                                Clear records
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Pagination
                  page={currentPage}
                  pages={pages}
                  total={total}
                  setPage={setPage}
                />
              </div>
            )}
            {section === 'adminAccess' && permissions.manageAdmins && (
              <AdminAccessPanel
                key={adminTarget?.email || 'manual'}
                access={access}
                target={adminTarget}
                onSubmit={(method, fields) => setConfirmation({
                  title: method === 'POST' ? 'Grant admin access?' : method === 'PATCH' ? 'Update admin access?' : 'Remove admin access?',
                  description: method === 'DELETE'
                    ? `Remove administrator privileges from ${fields.to_user}? Their student account will remain.`
                    : `Set admin level ${fields.level} for ${fields.to_user}${fields.locked == null ? '' : fields.locked ? ' and mark the admin locked' : ' and mark the admin unlocked'}?`,
                  label: method === 'POST' ? 'Grant access' : method === 'PATCH' ? 'Update access' : 'Remove access',
                  danger: method === 'DELETE',
                  run: () => admin.assign(method, fields),
                })}
              />
            )}
            {section === 'schools' && permissions.schools && (
              <SchoolsPanel
                onError={handleError}
                onAdded={(result) => {
                  setError('')
                  setNotice(result)
                }}
                onDelete={(school) => setConfirmation({
                  title: 'Delete this school?',
                  description: `Remove ${school.name} (${school.short_name}) from the school list?`,
                  label: 'Delete school',
                  danger: true,
                  run: () => admin.deleteSchool(school),
                })}
              />
            )}
            {section === 'sessions' && permissions.endSessions && (
              <div className="admin-card admin-session-card">
                <h2>Find a user by email</h2>
                <p>
                  Enter the exact account email. The service checks that the
                  target user is eligible before ending their sessions.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    askEndSessions(targetEmail)
                  }}
                >
                  <label>
                    Account email
                    <input
                      type="email"
                      required
                      value={targetEmail}
                      onChange={(event) => setTargetEmail(event.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <button className="admin-button primary">
                    End sessions…
                  </button>
                </form>
              </div>
            )}
          </>
        )}
        <p className="admin-footer-note">
          <span aria-hidden="true">◈</span> Student Exchange administration ·
          Access is checked for every action.
        </p>
      </section>
      {selected && (
        <ProfileEditor
          key={selected.email}
          profile={selected}
          canEndSessions={permissions.endSessions}
          onClose={() => setSelected(null)}
          onEndSessions={() => {
            setSelected(null)
            askEndSessions(selected.email)
          }}
          onSaved={(result) => {
            setNotice(result)
            setSelected(null)
            setRevision((value) => value + 1)
          }}
          onError={handleError}
        />
      )}
      {confirmation && (
        <ConfirmationDialog
          confirmation={confirmation}
          busy={busy}
          error={error}
          onCancel={() => {
            if (!busy) {
              setConfirmation(null)
              setError('')
            }
          }}
          onConfirm={() => {
            void confirm()
          }}
        />
      )}
    </div>
  )
}

function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="admin-search">
      <span aria-hidden="true">⌕</span>
      <span className="sr-only">Search admin records</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
function Avatar({ name }: { name: string }) {
  return (
    <span className="admin-avatar" aria-hidden="true">
      {name
        .split(/[ ,]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')}
    </span>
  )
}
function Trash() {
  return (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" />
    </svg>
  )
}
function Empty({
  title,
  description,
  clear,
}: {
  title: string
  description: string
  clear?: () => void
}) {
  return (
    <div className="admin-empty">
      <span aria-hidden="true">◎</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {clear && (
        <button className="admin-button" onClick={clear}>
          Clear filters
        </button>
      )}
    </div>
  )
}
function Pagination({
  page,
  pages,
  total,
  setPage,
}: {
  page: number
  pages: number
  total: number
  setPage: (page: number) => void
}) {
  return (
    <div className="admin-pagination">
      <span>
        {total
          ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`
          : '0 results'}
      </span>
      <div>
        <button
          className="admin-button"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          aria-label="Previous page"
        >
          ←
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          className="admin-button"
          disabled={page === pages}
          onClick={() => setPage(page + 1)}
          aria-label="Next page"
        >
          →
        </button>
      </div>
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
  busy = false,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  busy?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return (
    <dialog
      ref={dialog}
      className="admin-dialog"
      aria-labelledby="admin-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="admin-dialog-heading">
        <h2 id="admin-dialog-title">{title}</h2>
        <button
          className="admin-icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}
function ConfirmationDialog({
  confirmation,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  confirmation: Confirmation
  busy: boolean
  error: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  return (
    <Modal title={confirmation.title} onClose={onCancel} busy={busy}>
      <p>{confirmation.description}</p>
      {confirmation.email && (
        <label className="admin-confirm-email">
          Type <strong>{confirmation.email}</strong> to confirm
          <input
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={busy}
          />
        </label>
      )}
      {error && (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-dialog-actions">
        <button className="admin-button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          className={`admin-button ${confirmation.danger ? 'destructive' : 'primary'}`}
          disabled={
            busy || Boolean(confirmation.email && typed !== confirmation.email)
          }
          onClick={onConfirm}
        >
          {busy ? 'Working…' : confirmation.label}
        </button>
      </div>
    </Modal>
  )
}
function ProfileEditor({
  profile,
  canEndSessions,
  onClose,
  onEndSessions,
  onSaved,
  onError,
}: {
  profile: Profile
  canEndSessions: boolean
  onClose: () => void
  onEndSessions: () => void
  onSaved: (message: string) => void
  onError: (error: unknown) => void
}) {
  const [fields, setFields] = useState({ ...profile, password: '' })
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changes: ProfileUpdate = Object.fromEntries(
    Object.entries(fields).filter(
      ([key, value]) =>
        value.trim() &&
        (key === 'password' || value.trim() !== profile[key as keyof Profile]),
    ),
  )
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !Object.keys(changes).length ||
      (fields.password && fields.password !== confirmation)
    )
      return
    setBusy(true)
    setError('')
    try {
      const result = await admin.update(profile.email, changes)
      onSaved(result.message)
    } catch (reason) {
      setError(message(reason))
      if (
        reason instanceof AccountApiError &&
        [401, 403].includes(reason.status)
      ) {
        onClose()
        onError(reason)
      }
    } finally {
      setFields((current) => ({ ...current, password: '' }))
      setConfirmation('')
      setBusy(false)
    }
  }
  return (
    <Modal title="Manage student" onClose={onClose} busy={busy}>
      <div className="admin-editor-identity">
        <Avatar name={`${profile.first_name} ${profile.last_name}`} />
        <span>
          <strong>
            {profile.first_name} {profile.last_name}
          </strong>
          <small>{profile.email}</small>
        </span>
      </div>
      {error && (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      )}
      <form
        className="account-form admin-editor-form"
        onSubmit={(event) => {
          void save(event)
        }}
      >
        <fieldset disabled={busy}>
          <legend className="sr-only">Edit student profile</legend>
          {(['first_name', 'last_name'] as const).map((key) => (
            <label key={key}>
              {key === 'first_name' ? 'First name' : 'Last name'}
              <input
                required
                value={fields[key]}
                pattern="[A-Za-z]+(?: +[A-Za-z]+)*"
                title="Use ASCII letters and spaces between words."
                onChange={(event) =>
                  setFields((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
          <label>
            Email
            <input
              type="email"
              required
              maxLength={50}
              value={fields.email}
              onChange={(event) =>
                setFields((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </label>
          <SchoolSelect
            idPrefix="admin-"
            value={fields.school}
            onChange={(school) =>
              setFields((current) => ({ ...current, school }))
            }
          />
          <PasswordField
            idPrefix="admin-"
            registration
            optional
            value={fields.password}
            onChange={(password) =>
              setFields((current) => ({ ...current, password }))
            }
          />
          <ConfirmPasswordField
            idPrefix="admin-"
            password={fields.password}
            value={confirmation}
            required={Boolean(fields.password)}
            onChange={setConfirmation}
          />
          <p className="admin-caption">
            Leave the password empty to keep it unchanged.
          </p>
          <div className="admin-dialog-actions">
            <button type="button" className="admin-button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="admin-button primary"
              disabled={
                !Object.keys(changes).length ||
                Boolean(fields.password && fields.password !== confirmation)
              }
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </fieldset>
      </form>
      {canEndSessions && (
        <div className="admin-editor-sessions">
          <div>
            <strong>Account sessions</strong>
            <p>Sign this student out on all devices.</p>
          </div>
          <button
            className="admin-button"
            disabled={busy}
            onClick={onEndSessions}
          >
            End sessions…
          </button>
        </div>
      )}
    </Modal>
  )
}
