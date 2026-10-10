// @vitest-environment node
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { expect, it } from 'vitest'
import { createWebsiteServer } from './app.mjs'
import { createTestAccountCleaner } from './test-account-cleanup.mjs'
import { createForwardingClient } from './api.mjs'

// Routine npm test stays offline. Explicit opt-in is required to create live records.
it.skipIf(process.env.RUN_LIVE_API_TESTS !== '1')(
  'registers a live test user and deletes it in finally with sudo authorization',
  async () => {
    const config = {
      backend: process.env.backend,
      appAccess: process.env.app_access,
      user: process.env.user,
      userPass: process.env.user_pass,
      sudoUser: process.env.sudo_user,
      sudoPass: process.env.sudo_pass,
    }
    // Validate cleanup configuration and authenticate before creating any live record.
    const cleaner = createTestAccountCleaner(config)
    await cleaner.login()
    const website = createWebsiteServer({
      ...config,
      production: false,
      timeoutMs: 30000,
    })
    website.listen(0, '127.0.0.1')
    await once(website, 'listening')
    const base = `http://127.0.0.1:${website.address().port}`
    const email = `codex.live.${randomBytes(6).toString('hex')}@example.com`
    const password = `Fixture!${randomBytes(10).toString('hex')}`
    let registrationAttempted = false
    try {
      const schoolsResponse = await fetch(`${base}/api/schools`)
      expect(schoolsResponse.status).toBe(200)
      const { schools } = await schoolsResponse.json()
      expect(schools.length).toBeGreaterThan(0)
      // Mark before sending so cleanup also covers a lost registration response.
      registrationAttempted = true
      const registration = await fetch(`${base}/api/register`, {
        method: 'POST',
        headers: { Origin: base, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          first_name: 'Codex',
          last_name: 'Cleanup',
          school: schools[0],
        }),
      })
      expect(registration.status).toBe(201)
      const login = await fetch(`${base}/api/login`, {
        method: 'POST',
        headers: { Origin: base, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      expect(login.status).toBe(200)
      expect((await login.json()).profile.email).toBe(email)
    } finally {
      try {
        if (registrationAttempted) await cleaner.deleteAccount(email)
      } catch (error) {
        // Report only the generated test identifier so failed cleanup can be repaired.
        console.error(`Cleanup needs attention for test account ${email}.`)
        throw error
      } finally {
        website.closeAllConnections()
        await new Promise((resolve) => website.close(resolve))
      }
    }
    // A successful DELETE response alone is insufficient: the removed user must
    // no longer authenticate with the password created by this test.
    await expect(
      createForwardingClient(config).call('LogIn', 'POST', {
        email,
        password,
      }, '127.0.0.1'),
    ).rejects.toMatchObject({ status: 400 })
  },
  120000,
)
