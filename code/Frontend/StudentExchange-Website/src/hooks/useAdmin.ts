import { useEffect, useRef, useState } from 'react'
import { admin } from '../api/admin'
import type { AdminAccess } from '../api/admin'
import { AccountApiError } from '../api/accounts'
import type { Profile } from '../api/accounts'

export function useAdmin(
  profile: Profile | null,
  onSessionExpired?: () => void,
) {
  const expire = useRef(onSessionExpired)
  expire.current = onSessionExpired
  const [state, setState] = useState<{
    owner: Profile | null
    access: AdminAccess | null
    error: string
  }>({ owner: null, access: null, error: '' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!profile) return
    const controller = new AbortController()
    setState({ owner: null, access: null, error: '' })
    admin
      .access(controller.signal)
      .then((access) => {
        if (!controller.signal.aborted)
          setState({ owner: profile, access, error: '' })
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          if (reason instanceof AccountApiError && reason.status === 401)
            expire.current?.()
          setState({
            owner: profile,
            access: null,
            error:
              reason instanceof Error
                ? reason.message
                : 'Unable to check administrator access.',
          })
        }
      })
    return () => controller.abort()
  }, [profile, attempt])
  return {
    access: profile && state.owner === profile ? state.access : null,
    error: profile && state.owner === profile ? state.error : '',
    loading: Boolean(profile && state.owner !== profile),
    refresh: () => {
      setState({ owner: null, access: null, error: '' })
      setAttempt((value) => value + 1)
    },
  }
}
