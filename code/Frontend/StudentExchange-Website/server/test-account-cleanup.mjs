import { isIP } from 'node:net'
import { backendUrl, upstream } from './api.mjs'

/**
 * Test-only privileged cleanup. No browser route imports this module.
 * Limit deletion to explicitly named test accounts, never arbitrary user input.
 */
export function createTestAccountCleaner({
  backend,
  appAccess,
  adminToken,
  sudoUser,
  sudoPass,
  ip = '127.0.0.1',
}) {
  const base = backendUrl(backend)
  if (!base || !appAccess || !adminToken || !sudoUser || !sudoPass || !isIP(ip))
    throw new Error(
      'Test cleanup requires backend, app_access, admin_token, sudo_user, sudo_pass, and a valid IP.',
    )
  const envelope = { app_access: appAccess, admin_token: adminToken, ip }
  let token
  return {
    async login() {
      try {
        const result = await upstream(base, 'LogIn', 'POST', {
          ...envelope,
          email: sudoUser,
          password: sudoPass,
        })
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
        await upstream(base, 'Register', 'DELETE', {
          ...envelope,
          access_token: token,
          to_user: email,
        })
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
