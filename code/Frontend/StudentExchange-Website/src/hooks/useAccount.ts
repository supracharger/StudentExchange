import { useEffect, useState } from 'react'
import { accounts, AccountApiError } from '../api/accounts'
import type { Profile, ProfileUpdate, Registration } from '../api/accounts'

export function useAccount() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    // Restore the HttpOnly-cookie session without storing credentials in localStorage.
    // Abort on cleanup so StrictMode and unmounts cannot overwrite newer account state.
    const controller = new AbortController()
    accounts
      .profile(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setProfile(data.profile)
      })
      .catch((reason) => {
        if (
          !controller.signal.aborted &&
          !(reason instanceof AccountApiError && reason.status === 401)
        ) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Unable to restore your account.',
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setRestoring(false)
      })
    return () => controller.abort()
  }, [])

  function clearMessages() {
    setError('')
    setNotice('')
  }

  /** Keep failures visible; clear the signed-in UI only on confirmed session expiry. */
  async function perform(operation: () => Promise<void>) {
    clearMessages()
    setBusy(true)
    try {
      await operation()
      return true
    } catch (reason) {
      if (reason instanceof AccountApiError && reason.status === 401)
        setProfile(null)
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to complete this request.',
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    profile,
    restoring,
    busy,
    error,
    notice,
    clearMessages,
    login: (email: string, password: string) =>
      perform(async () => {
        const data = await accounts.login(email, password)
        setProfile(data.profile)
        setNotice(`Welcome back, ${data.profile.first_name}.`)
      }),
    register: (fields: Registration) =>
      perform(async () => {
        const data = await accounts.register(fields)
        setNotice(data.message)
      }),
    update: (fields: ProfileUpdate) =>
      perform(async () => {
        const data = await accounts.update(fields)
        // A PATCH may succeed before its follow-up read fails. Preserve the old profile,
        // show the refresh-needed message, and never silently retry a password write.
        if (data.profile) setProfile(data.profile)
        setNotice(data.message)
      }),
    reload: () =>
      perform(async () => {
        setProfile((await accounts.profile()).profile)
      }),
    logout: () =>
      perform(async () => {
        await accounts.logout()
        setProfile(null)
        setNotice('You have been logged out of all sessions.')
      }),
  }
}

export type AccountState = ReturnType<typeof useAccount>
