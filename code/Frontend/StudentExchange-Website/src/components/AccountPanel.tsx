import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { accounts } from '../api/accounts'
import type { Profile, ProfileUpdate, Registration } from '../api/accounts'
import type { AccountState } from '../hooks/useAccount'

const EMPTY: Registration = {
  email: '',
  first_name: '',
  last_name: '',
  school: '',
  password: '',
}
const PASSWORD_PATTERN =
  '(?=.*[A-Z])(?=.*[!@#$%^&*_=+\\-])[A-Za-z0-9!@#$%^&*_=+\\-]{8,50}'

/** Accessible inline account area; no token or shared credential is ever rendered. */
export default function AccountPanel({
  account,
  onClose,
}: {
  account: AccountState
  onClose: () => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [fields, setFields] = useState<Registration>(EMPTY)
  // Confirmation stays in UI state and is never part of the backend payload.
  const [confirmPassword, setConfirmPassword] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === 'register' && fields.password !== confirmPassword) return
    if (mode === 'login') {
      const succeeded = await account.login(fields.email, fields.password)
      // Clear passwords after every attempt, including failed logins.
      setFields((current) => ({ ...current, password: '' }))
      if (succeeded) setFields(EMPTY)
    } else if (await account.register(fields)) {
      setFields({ ...EMPTY, email: fields.email })
      setMode('login')
    } else setFields((current) => ({ ...current, password: '' }))
    setConfirmPassword('')
  }

  return (
    <section
      id="account"
      className="account-panel"
      aria-labelledby="account-title"
      aria-busy={account.busy || account.restoring}
    >
      <div className="account-heading">
        <div>
          <p className="eyebrow">YOUR STUDENT COMMUNITY</p>
          <h2 id="account-title" ref={heading} tabIndex={-1}>
            {account.profile
              ? 'Your account'
              : mode === 'register'
                ? 'Join Student Exchange'
                : 'Welcome back'}
          </h2>
        </div>
        <button
          type="button"
          className="account-close"
          onClick={onClose}
          aria-label="Close account panel"
        >
          ×
        </button>
      </div>
      {account.error && (
        <p className="account-error" role="alert">
          {account.error}
        </p>
      )}
      {account.notice && (
        <p className="account-notice" role="status">
          {account.notice}
        </p>
      )}
      {account.restoring ? (
        <p role="status">Checking your session…</p>
      ) : account.profile ? (
        <ProfileForm account={account} profile={account.profile} />
      ) : (
        <>
          <div
            className="account-tabs"
            role="group"
            aria-label="Account options"
          >
            <button
              type="button"
              aria-pressed={mode === 'login'}
              disabled={account.busy}
              onClick={() => {
                setMode('login')
                setConfirmPassword('')
                setFields((current) => ({ ...current, password: '' }))
                account.clearMessages()
              }}
            >
              Log in
            </button>
            <button
              type="button"
              aria-pressed={mode === 'register'}
              disabled={account.busy}
              onClick={() => {
                setMode('register')
                setConfirmPassword('')
                setFields((current) => ({ ...current, password: '' }))
                account.clearMessages()
              }}
            >
              Create account
            </button>
          </div>
          <form onSubmit={submit} className="account-form">
            <fieldset disabled={account.busy}>
              <legend className="sr-only">
                {mode === 'register' ? 'Registration details' : 'Login details'}
              </legend>
              {mode === 'register' && (
                <>
                  <TextField
                    name="first_name"
                    label="First name"
                    value={fields.first_name}
                    onChange={(value) =>
                      setFields((current) => ({
                        ...current,
                        first_name: value,
                      }))
                    }
                  />
                  <TextField
                    name="last_name"
                    label="Last name"
                    value={fields.last_name}
                    onChange={(value) =>
                      setFields((current) => ({ ...current, last_name: value }))
                    }
                  />
                </>
              )}
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={50}
                  required
                  value={fields.email}
                  onChange={(event) =>
                    setFields((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <PasswordField
                registration={mode === 'register'}
                value={fields.password}
                onChange={(value) =>
                  setFields((current) => ({ ...current, password: value }))
                }
              />
              {mode === 'register' && (
                <ConfirmPasswordField
                  password={fields.password}
                  value={confirmPassword}
                  required
                  onChange={setConfirmPassword}
                />
              )}
              {mode === 'register' && (
                <SchoolSelect
                  value={fields.school}
                  onChange={(value) =>
                    setFields((current) => ({ ...current, school: value }))
                  }
                />
              )}
              <button
                type="submit"
                className="button-primary"
                disabled={mode === 'register' && !fields.school}
              >
                {account.busy
                  ? 'Please wait…'
                  : mode === 'register'
                    ? 'Register'
                    : 'Log in to your account'}
              </button>
            </fieldset>
          </form>
        </>
      )}
    </section>
  )
}

function TextField({
  name,
  label,
  value,
  onChange,
}: {
  name: 'first_name' | 'last_name'
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        autoComplete={name === 'first_name' ? 'given-name' : 'family-name'}
        pattern="[A-Za-z]+(?: +[A-Za-z]+)*"
        title="Use letters A–Z and spaces between words, as required by the account service."
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export function PasswordField({
  registration,
  optional = false,
  value,
  onChange,
  idPrefix = '',
}: {
  registration: boolean
  optional?: boolean
  value: string
  onChange: (value: string) => void
  idPrefix?: string
}) {
  const [visible, setVisible] = useState(false)
  const id = `${idPrefix}${optional ? 'new-password' : 'account-password'}`
  return (
    <div className="password-field">
      <label htmlFor={id}>
        {optional ? 'New password (optional)' : 'Password'}
      </label>
      <div className="password-input">
        <input
          id={id}
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete={registration ? 'new-password' : 'current-password'}
          required={!optional}
          minLength={registration ? 8 : undefined}
          maxLength={50}
          pattern={registration ? PASSWORD_PATTERN : undefined}
          aria-describedby={registration ? `${id}-help` : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {registration && (
        <small id={`${id}-help`}>
          8–50 characters, including an uppercase letter and one of
          !@#$%^&amp;*_-+=. Use only letters A–Z, numbers, and these symbols.
        </small>
      )}
    </div>
  )
}

/** Use native form validity plus an inline message; compare exact, untrimmed passwords. */
export function ConfirmPasswordField({
  password,
  value,
  required,
  onChange,
  idPrefix = '',
}: {
  password: string
  value: string
  required: boolean
  onChange: (value: string) => void
  idPrefix?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const id = `${idPrefix}confirm-password`
  const mismatch = Boolean(value) && value !== password
  useEffect(() => {
    input.current?.setCustomValidity(mismatch ? 'Passwords do not match.' : '')
  }, [mismatch])
  return (
    <div className="password-field">
      <label htmlFor={id}>Confirm Password</label>
      <input
        ref={input}
        id={id}
        name="confirm_password"
        type="password"
        autoComplete="new-password"
        maxLength={50}
        required={required}
        value={value}
        aria-invalid={mismatch || undefined}
        aria-describedby={mismatch ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {mismatch && (
        <small id={`${id}-error`} className="account-error" role="alert">
          Passwords do not match.
        </small>
      )}
    </div>
  )
}

export function SchoolSelect({
  value,
  onChange,
  idPrefix = '',
}: {
  value: string
  onChange: (value: string) => void
  idPrefix?: string
}) {
  const id = `${idPrefix}account-school`
  const [schools, setSchools] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    accounts
      .schools(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setSchools(data.schools)
        if (data.schools.length === 0)
          setError('No schools are available yet. Please try again later.')
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to load schools.',
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [attempt])
  const options =
    value && !schools.includes(value) ? [value, ...schools] : schools
  return (
    <div className="school-field">
      <label htmlFor={id}>School</label>
      <select
        id={id}
        name="school"
        required
        disabled={loading || Boolean(error)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {loading ? 'Loading schools…' : 'Select your school'}
        </option>
        {options.map((school) => (
          <option key={school} value={school}>
            {school}
          </option>
        ))}
      </select>
      {error && (
        <div className="field-error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => setAttempt(attempt + 1)}>
            Retry school lookup
          </button>
        </div>
      )}
    </div>
  )
}

function ProfileForm({
  account,
  profile,
}: {
  account: AccountState
  profile: Profile
}) {
  const [fields, setFields] = useState<Registration>({
    ...profile,
    password: '',
  })
  const [savedLocally, setSavedLocally] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  useEffect(() => {
    setFields({ ...profile, password: '' })
    setSavedLocally(false)
    setConfirmPassword('')
  }, [profile])
  // Send only changed fields; never re-send an unchanged password or overwrite omitted values.
  const changes: ProfileUpdate = Object.fromEntries(
    Object.entries(fields).filter(
      ([key, value]) =>
        typeof value === 'string' &&
        value.trim() &&
        (key === 'password' || value.trim() !== profile[key as keyof Profile]),
    ),
  )
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (fields.password && fields.password !== confirmPassword) return
    const succeeded = await account.update(changes)
    setFields((current) => ({ ...current, password: '' }))
    setConfirmPassword('')
    setSavedLocally(succeeded)
  }
  return (
    <>
      <p className="account-subtitle">
        Signed in as <strong>{profile.email}</strong>. Keep your details up to
        date.
      </p>
      <form onSubmit={submit} className="account-form">
        <fieldset disabled={account.busy}>
          <legend className="sr-only">Edit profile</legend>
          <TextField
            name="first_name"
            label="First name"
            value={fields.first_name}
            onChange={(value) => {
              setSavedLocally(false)
              setFields((current) => ({ ...current, first_name: value }))
            }}
          />
          <TextField
            name="last_name"
            label="Last name"
            value={fields.last_name}
            onChange={(value) => {
              setSavedLocally(false)
              setFields((current) => ({ ...current, last_name: value }))
            }}
          />
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={50}
              required
              value={fields.email}
              onChange={(event) => {
                setSavedLocally(false)
                setFields((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }}
            />
          </label>
          {(['user', 'location'] as const).map((key) => (
            <label key={key}>
              {key === 'user' ? 'Username' : 'Pickup location'}
              <input
                value={fields[key] || ''}
                maxLength={key === 'user' ? 50 : 200}
                pattern={key === 'user' ? '[A-Za-z0-9_-]+' : undefined}
                onChange={(event) =>
                  setFields((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
          <SchoolSelect
            value={fields.school}
            onChange={(value) => {
              setSavedLocally(false)
              setFields((current) => ({ ...current, school: value }))
            }}
          />
          <PasswordField
            registration
            optional
            value={fields.password}
            onChange={(value) => {
              setSavedLocally(false)
              setFields((current) => ({ ...current, password: value }))
              if (!value) setConfirmPassword('')
            }}
          />
          <ConfirmPasswordField
            password={fields.password}
            value={confirmPassword}
            required={Boolean(fields.password)}
            onChange={setConfirmPassword}
          />
          <div className="account-actions">
            <button
              type="submit"
              className="button-primary"
              disabled={Object.keys(changes).length === 0 || savedLocally}
            >
              {account.busy ? 'Please wait…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                void account.reload()
              }}
            >
              Reload profile
            </button>
          </div>
        </fieldset>
      </form>
      <div className="logout-row">
        <p>Logging out ends all sessions for this account.</p>
        <button
          type="button"
          className="button-secondary"
          disabled={account.busy}
          onClick={() => {
            void account.logout()
          }}
        >
          Log out
        </button>
      </div>
    </>
  )
}
