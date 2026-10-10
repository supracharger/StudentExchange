import { isIP } from 'node:net'
import { backendUrl, createForwardingClient } from './api.mjs'

/**
 * Test-only privileged cleanup. No browser route imports this module.
 * Limit deletion to explicitly named test accounts, never arbitrary user input.
 */
export function createTestAccountCleaner({
  backend,
  appAccess,
  user,
  userPass,
  sudoUser,
  sudoPass,
  ip = '127.0.0.1',
}) {
  const base = backendUrl(backend)
  if (!base || !appAccess || !user || !userPass || !sudoUser || !sudoPass || !isIP(ip))
    throw new Error(
      'Test cleanup requires backend, app_access, user, user_pass, sudo_user, sudo_pass, and a valid IP.',
    )
  const service = createForwardingClient({ backend, appAccess, user, userPass })
  let token
  return {
    async login() {
      try {
        const result = await service.call('LogIn', 'POST', {
          email: sudoUser,
          password: sudoPass,
        }, ip)
        if (typeof result?.access_token !== 'string' || !result.access_token)
          throw new Error()
        token = result.access_token
      } catch {
        // Even a malformed backend error must not expose the privileged username/password.
        throw new Error(
          'Privileged test-cleanup login failed; no credentials were logged.',
        )
      }
    },
    async deleteAccount(email) {
      if (
        !/^codex\.(?:test|browser|forward|live)\.[a-z0-9]+@example\.com$/.test(
          email,
        ) ||
        email === sudoUser
      )
        throw new Error('Cleanup can delete only designated test accounts.')
      if (!token) await this.login()
      try {
        await service.call('Register', 'DELETE', {
          access_token: token,
          to_user: email,
        }, ip)
      } catch (error) {
        throw new Error(
          `Test-account deletion failed (status ${error.status ?? 'unknown'}).`,
        )
      }
      // Do not call DELETE /LogIn: that revokes every session of the shared sudo user.
      // The privileged token is kept only in this short-lived helper's memory.
    },
  }
}
