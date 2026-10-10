// @vitest-environment node
import http from 'node:http'
import { once } from 'node:events'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWebsiteServer } from './app.mjs'
import { createTestAccountCleaner } from './test-account-cleanup.mjs'

const APP_KEY = 'fixture-application-key'
const ADMIN_KEY = 'fixture-forwarding-key'
const USER_TOKEN = 'fixture-user-token'
const SUDO_USER = 'fixture-admin@example.com'
const SUDO_PASS = 'FixtureAdmin!123'
const SUDO_TOKEN = 'fixture-admin-token'
const initialProfile = {
  email: 'codex.test.fixture@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  school: 'University of Colorado Denver',
}
let upstreamServer,
  website,
  base,
  calls,
  profile,
  failure,
  expectedIp,
  registeredEmails

async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}

beforeEach(async () => {
  registeredEmails = new Set()
  calls = []
  profile = { ...initialProfile }
  failure = null
  expectedIp = '127.0.0.1'
  // A real HTTP fixture checks wire behavior, especially the GET body browsers cannot send.
  upstreamServer = http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const text = Buffer.concat(chunks).toString()
    const body = text ? JSON.parse(text) : undefined
    if (request.url === '/service/LogIn' && body?.email === 'service@example.com') {
      response.writeHead(201)
      response.end(JSON.stringify({ access_token: ADMIN_KEY }))
      return
    }
    if (request.url === '/service/Admin' && !body?.ip) {
      response.end(JSON.stringify({ is_admin: true, level: 0 }))
      return
    }
    calls.push({ method: request.method, path: request.url, body })
    response.setHeader('Content-Type', 'application/json')
    if (
      failure?.path === request.url &&
      (!failure.method || failure.method === request.method)
    ) {
      // Capture this response before awaiting; later tests may replace the fixture's failure mode.
      const currentFailure = failure
      if (currentFailure.flushHeaders) {
        response.writeHead(currentFailure.status)
        response.flushHeaders()
      }
      if (currentFailure.delay)
        await new Promise((resolve) =>
          setTimeout(resolve, currentFailure.delay),
        )
      if (!currentFailure.flushHeaders)
        response.writeHead(currentFailure.status)
      response.end(JSON.stringify(currentFailure.body))
      return
    }
    if (request.url === '/service/Schools') {
      response.end(
        JSON.stringify({
          schools: [
            'University of Colorado Denver',
            'Metropolitan State University of Denver',
          ],
        }),
      )
      return
    }
    if (
      body?.app_access !== APP_KEY ||
      body?.admin_token !== ADMIN_KEY ||
      body?.ip !== expectedIp
    ) {
      response.writeHead(401)
      response.end(JSON.stringify({ message: 'Not authorized.' }))
      return
    }
    if (request.url === '/service/LogIn' && request.method === 'POST') {
      if (body.email === SUDO_USER) {
        response.writeHead(body.password === SUDO_PASS ? 201 : 401)
        response.end(JSON.stringify({ access_token: SUDO_TOKEN }))
        return
      }
      response.writeHead(201)
      response.end(
        JSON.stringify({ access_token: USER_TOKEN, first_name: 'Jane' }),
      )
      return
    }
    if (request.url === '/service/Register' && request.method === 'DELETE') {
      if (body.access_token !== SUDO_TOKEN) {
        response.writeHead(403)
        response.end(JSON.stringify({ message: 'Sudo privilege required.' }))
        return
      }
      if (typeof body.to_user !== 'string' || 'email' in body) {
        response.writeHead(400)
        response.end(JSON.stringify({ message: 'Use to_user for deletion.' }))
        return
      }
      registeredEmails.delete(body.to_user)
      response.end(JSON.stringify({ message: 'User deleted.' }))
      return
    }
    if (request.url === '/service/Register' && request.method === 'POST') {
      registeredEmails.add(body.email.toLowerCase())
      response.writeHead(201)
      response.end(
        JSON.stringify({
          message: 'User added.',
          email: body.email.toLowerCase(),
        }),
      )
      return
    }
    if (body?.access_token !== USER_TOKEN) {
      response.writeHead(400)
      response.end(JSON.stringify({ message: 'Unknown token.' }))
      return
    }
    if (request.url === '/service/Register' && request.method === 'GET') {
      response.end(JSON.stringify({ ...profile, password: 'must-never-leak' }))
      return
    }
    if (request.url === '/service/Register' && request.method === 'PATCH') {
      for (const key of Object.keys(profile))
        if (body[key]) profile[key] = body[key]
      response.end(JSON.stringify({ message: 'Successfully updated.' }))
      return
    }
    response.end(JSON.stringify({ message: 'You have been logged out.' }))
  })
  const upstreamBase = await listen(upstreamServer)
  website = createWebsiteServer({
    backend: `${upstreamBase}/service`,
    appAccess: APP_KEY,
    user: 'service@example.com',
      userPass: 'Service!123',
    production: false,
    timeoutMs: 500,
  })
  base = await listen(website)
})

afterEach(async () => {
  try {
    // Cleanup runs even when a test assertion fails. Fake users exercise the same
    // sudo login + DELETE contract used by the explicitly enabled live test.
    failure = null
    if (registeredEmails.size) {
      const cleaner = createTestAccountCleaner({
        backend: `http://127.0.0.1:${upstreamServer.address().port}/service/`,
        appAccess: APP_KEY,
        user: 'service@example.com',
      userPass: 'Service!123',
        sudoUser: SUDO_USER,
        sudoPass: SUDO_PASS,
        ip: expectedIp,
      })
      for (const email of [...registeredEmails])
        await cleaner.deleteAccount(email)
      expect(registeredEmails.size).toBe(0)
    }
  } finally {
    for (const server of [website, upstreamServer]) {
      if (!server) continue
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    }
  }
})

function call(path, method = 'GET', body, cookie, origin = base) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(method !== 'GET' ? { Origin: origin } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function login() {
  const response = await call('/api/login', 'POST', {
    email: initialProfile.email,
    password: 'Fixture!123',
  })
  expect(response.status).toBe(200)
  return { response, cookie: response.headers.get('set-cookie').split(';')[0] }
}

describe('same-origin backend adapter', () => {
  it('accepts lowercase schools and forwards the visitor IP', async () => {
    const response = await call('/api/schools')
    expect(response.status).toBe(200)
    expect((await response.json()).schools).toHaveLength(2)
    expect(calls).toEqual([
      {
        method: 'GET',
        path: '/service/Schools',
        body: { ip: expectedIp, admin_token: ADMIN_KEY, app_access: APP_KEY },
      },
    ])
  })

  it('requires lowercase schools and rejects the obsolete capitalized field', async () => {
    failure = {
      path: '/service/Schools',
      status: 200,
      body: { Schools: ['Legacy school'] },
    }
    expect((await call('/api/schools')).status).toBe(502)
    failure.body = { schools: ['Current school'], Schools: ['Legacy school'] }
    expect(await (await call('/api/schools')).json()).toEqual({
      schools: ['Current school'],
    })
    failure.body = { schools: [null], Schools: ['Legacy school'] }
    expect((await call('/api/schools')).status).toBe(502)
  })

  it('deletes a registered test account only after privileged login', async () => {
    await call('/api/register', 'POST', {
      ...initialProfile,
      password: 'Fixture!123',
    })
    expect(registeredEmails.has(initialProfile.email)).toBe(true)
    const cleaner = createTestAccountCleaner({
      backend: `http://127.0.0.1:${upstreamServer.address().port}/service/`,
      appAccess: APP_KEY,
      user: 'service@example.com',
      userPass: 'Service!123',
      sudoUser: SUDO_USER,
      sudoPass: SUDO_PASS,
    })
    await expect(
      cleaner.deleteAccount('real.user@example.com'),
    ).rejects.toThrow('designated test accounts')
    await cleaner.deleteAccount(initialProfile.email)
    expect(registeredEmails.size).toBe(0)
    expect(calls.slice(-2)).toEqual([
      {
        method: 'POST',
        path: '/service/LogIn',
        body: {
          app_access: APP_KEY,
          admin_token: ADMIN_KEY,
          ip: '127.0.0.1',
          email: SUDO_USER,
          password: SUDO_PASS,
        },
      },
      {
        method: 'DELETE',
        path: '/service/Register',
        body: {
          app_access: APP_KEY,
          admin_token: ADMIN_KEY,
          ip: '127.0.0.1',
          to_user: initialProfile.email,
          access_token: SUDO_TOKEN,
        },
      },
    ])
  })

  it('reports privileged cleanup failures without exposing sudo credentials', async () => {
    const cleaner = createTestAccountCleaner({
      backend: `http://127.0.0.1:${upstreamServer.address().port}/service/`,
      appAccess: APP_KEY,
      user: 'service@example.com',
      userPass: 'Service!123',
      sudoUser: SUDO_USER,
      sudoPass: SUDO_PASS,
    })
    failure = {
      path: '/service/LogIn',
      status: 401,
      body: { message: `${SUDO_USER} ${SUDO_PASS}` },
    }
    await expect(cleaner.deleteAccount(initialProfile.email)).rejects.toThrow(
      'Privileged test-cleanup login failed; no credentials were logged.',
    )
    expect(calls.some((item) => item.method === 'DELETE')).toBe(false)
    failure = null
    await call('/api/register', 'POST', {
      ...initialProfile,
      password: 'Fixture!123',
    })
    await cleaner.login()
    failure = {
      path: '/service/Register',
      method: 'DELETE',
      status: 403,
      body: { message: SUDO_TOKEN },
    }
    await expect(cleaner.deleteAccount(initialProfile.email)).rejects.toThrow(
      'Test-account deletion failed (status 403).',
    )
    // The afterEach hook still removes the user after this simulated cleanup failure.
    expect(registeredEmails.has(initialProfile.email)).toBe(true)
  })

  it('registers with injected credentials and requires a separate login', async () => {
    const response = await call('/api/register', 'POST', {
      ...initialProfile,
      password: 'Fixture!123',
    })
    expect(response.status).toBe(201)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect((await response.json()).message).toContain('now log in')
    expect(calls[0].body.app_access).toBe(APP_KEY)
    expect((await call('/api/profile')).status).toBe(401)
  })

  it('logs in, restores and edits a profile, and logs out using the documented wire contract', async () => {
    const { response, cookie } = await login()
    expect(await response.json()).toEqual({ profile: initialProfile })
    const header = response.headers.get('set-cookie')
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Lax')
    expect(header).not.toContain(USER_TOKEN)
    expect(header).not.toContain(APP_KEY)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(calls[1]).toEqual({
      method: 'GET',
      path: '/service/Register',
      body: {
        app_access: APP_KEY,
        access_token: USER_TOKEN,
        admin_token: ADMIN_KEY,
        ip: '127.0.0.1',
      },
    })
    expect(
      (await (await call('/api/profile', 'GET', undefined, cookie)).json())
        .profile,
    ).toEqual(initialProfile)
    const update = await call(
      '/api/profile',
      'PATCH',
      { first_name: 'Alice', password: '' },
      cookie,
    )
    expect((await update.json()).profile.first_name).toBe('Alice')
    expect(calls.find((item) => item.method === 'PATCH').body).toEqual({
      first_name: 'Alice',
      app_access: APP_KEY,
      access_token: USER_TOKEN,
      admin_token: ADMIN_KEY,
      ip: '127.0.0.1',
    })
    const logout = await call('/api/logout', 'POST', {}, cookie)
    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(calls.at(-1)).toEqual({
      method: 'DELETE',
      path: '/service/LogIn',
      body: {
        app_access: APP_KEY,
        access_token: USER_TOKEN,
        admin_token: ADMIN_KEY,
        ip: '127.0.0.1',
      },
    })
    expect((await call('/api/profile', 'GET', undefined, cookie)).status).toBe(
      401,
    )
  })

  it('rejects cross-origin changes and credential injection before contacting the backend', async () => {
    expect(
      (
        await call(
          '/api/login',
          'POST',
          {},
          undefined,
          'https://another-site.example',
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await call('/api/login', 'POST', {
          email: 'jane@example.com',
          password: 'Fixture!123',
          app_access: 'attacker-value',
        })
      ).status,
    ).toBe(400)
    expect(calls).toHaveLength(0)
  })

  it('rejects unsupported routes, verbs, invalid JSON and oversized request bodies', async () => {
    expect((await call('/api/unknown')).status).toBe(404)
    const unsupported = await call('/api/login')
    expect(unsupported.status).toBe(405)
    expect(unsupported.headers.get('allow')).toBe('POST')
    const invalid = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json' },
      body: '{invalid',
    })
    expect(invalid.status).toBe(400)
    expect(
      (
        await call('/api/login', 'POST', {
          email: 'a'.repeat(20000),
          password: 'Fixture!123',
        })
      ).status,
    ).toBe(413)
    expect(calls).toHaveLength(0)
  })

  it('keeps duplicate-email conflicts useful but hides backend exception details', async () => {
    failure = {
      path: '/service/Register',
      method: 'POST',
      status: 409,
      body: 'A user with that email already exists.',
    }
    const duplicate = await call('/api/register', 'POST', {
      ...initialProfile,
      password: 'Fixture!123',
    })
    expect(duplicate.status).toBe(409)
    expect((await duplicate.json()).message).toContain('already exists')
    failure = {
      path: '/service/Schools',
      status: 500,
      body: { message: 'Exception with private database path and credentials' },
    }
    const broken = await call('/api/schools')
    expect(broken.status).toBe(502)
    expect(await broken.text()).not.toContain('private database')
  })

  it('redacts credential values from upstream validation errors', async () => {
    failure = {
      path: '/service/LogIn',
      status: 400,
      body: { message: `Rejected ${APP_KEY} ${ADMIN_KEY} Fixture!123` },
    }
    const response = await call('/api/login', 'POST', {
      email: initialProfile.email,
      password: 'Fixture!123',
    })
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).not.toContain(APP_KEY)
    expect(text).not.toContain(ADMIN_KEY)
    expect(text).not.toContain('Fixture!123')
    expect(text).toContain('[redacted]')
  })

  it('expires invalid backend tokens and clears the local cookie', async () => {
    const { cookie } = await login()
    failure = {
      path: '/service/Register',
      method: 'GET',
      status: 400,
      body: { message: 'Token has expired.' },
    }
    const expired = await call('/api/profile', 'GET', undefined, cookie)
    expect(expired.status).toBe(401)
    expect(expired.headers.get('set-cookie')).toContain('Max-Age=0')
    failure = null
    expect((await call('/api/profile', 'GET', undefined, cookie)).status).toBe(
      401,
    )
  })

  it('rotates session IDs and invalidates the old browser session', async () => {
    const first = await login()
    const second = await call(
      '/api/login',
      'POST',
      { email: initialProfile.email, password: 'Fixture!123' },
      first.cookie,
    )
    expect(second.headers.get('set-cookie')).not.toContain(first.cookie)
    expect(
      (await call('/api/profile', 'GET', undefined, first.cookie)).status,
    ).toBe(401)
  })

  it('does not clear a session when upstream logout fails', async () => {
    const { cookie } = await login()
    failure = {
      path: '/service/LogIn',
      method: 'DELETE',
      status: 500,
      body: {},
    }
    expect((await call('/api/logout', 'POST', {}, cookie)).status).toBe(502)
    expect((await call('/api/profile', 'GET', undefined, cookie)).status).toBe(
      200,
    )
  })

  it('reports saved profile changes separately from a failed follow-up read', async () => {
    const { cookie } = await login()
    failure = {
      path: '/service/Register',
      method: 'GET',
      status: 500,
      body: {},
    }
    const update = await call(
      '/api/profile',
      'PATCH',
      { first_name: 'Alice' },
      cookie,
    )
    expect(update.status).toBe(200)
    expect(await update.json()).toEqual({
      profile: null,
      message: 'Changes saved. Reload your profile to see the latest details.',
    })
    expect(profile.first_name).toBe('Alice')
  })

  it('times out upstream calls and refuses redirects instead of leaking credentials', async () => {
    failure = { path: '/service/Schools', status: 200, body: {}, delay: 700 }
    expect((await call('/api/schools')).status).toBe(504)
    failure = {
      path: '/service/Schools',
      status: 200,
      body: {},
      delay: 700,
      flushHeaders: true,
    }
    expect((await call('/api/schools')).status).toBe(504)
    failure = { path: '/service/LogIn', status: 302, body: {} }
    expect(
      (
        await call('/api/login', 'POST', {
          email: initialProfile.email,
          password: 'Fixture!123',
        })
      ).status,
    ).toBe(502)
  })

  it('rejects unexpected backend schemas and treats empty schools as a valid empty list', async () => {
    failure = { path: '/service/Schools', status: 200, body: { schools: [] } }
    expect(await (await call('/api/schools')).json()).toEqual({ schools: [] })
    failure.body = { schools: [null] }
    expect((await call('/api/schools')).status).toBe(502)
    failure = {
      path: '/service/LogIn',
      status: 201,
      body: { access_token: null },
    }
    expect(
      (
        await call('/api/login', 'POST', {
          email: initialProfile.email,
          password: 'Fixture!123',
        })
      ).status,
    ).toBe(502)
  })

  it('marks production cookies Secure and provides process health independently of accounts', async () => {
    const secure = createWebsiteServer({
      backend: `http://127.0.0.1:${upstreamServer.address().port}/service/`,
      appAccess: APP_KEY,
      user: 'service@example.com',
      userPass: 'Service!123',
      production: true,
    })
    const secureBase = await listen(secure)
    try {
      const response = await fetch(`${secureBase}/api/login`, {
        method: 'POST',
        headers: {
          Origin: secureBase.replace('http:', 'https:'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: initialProfile.email,
          password: 'Fixture!123',
        }),
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('set-cookie')).toContain('; Secure')
      expect(await (await fetch(`${secureBase}/healthz`)).json()).toEqual({
        status: 'ok',
        accountsConfigured: true,
      })
    } finally {
      secure.closeAllConnections()
      await new Promise((resolve) => secure.close(resolve))
    }
  })

  it('allows public schools without app_access and fails account writes clearly', async () => {
    const noSecret = createWebsiteServer({
      backend: `http://127.0.0.1:${upstreamServer.address().port}/service/`,
      production: false,
    })
    const noSecretBase = await listen(noSecret)
    try {
      expect((await fetch(`${noSecretBase}/api/schools`)).status).toBe(200)
      const response = await fetch(`${noSecretBase}/api/login`, {
        method: 'POST',
        headers: { Origin: noSecretBase, 'Content-Type': 'application/json' },
        body: '{}',
      })
      expect(response.status).toBe(503)
    } finally {
      noSecret.closeAllConnections()
      await new Promise((resolve) => noSecret.close(resolve))
    }
  })

  it('forwards the trusted Render visitor IP on every backend call, including Schools', async () => {
    expectedIp = '198.51.100.9'
    const render = createWebsiteServer({
      backend: `http://127.0.0.1:${upstreamServer.address().port}/service/`,
      appAccess: APP_KEY,
      user: 'service@example.com',
      userPass: 'Service!123',
      renderProxy: true,
      production: false,
    })
    const renderBase = await listen(render)
    let cookie
    async function renderCall(path, method = 'GET', body) {
      const response = await fetch(`${renderBase}/api/${path}`, {
        method,
        headers: {
          Origin: renderBase,
          'Content-Type': 'application/json',
          'cf-connecting-ip': expectedIp,
          'x-forwarded-for': '203.0.113.66, 192.0.2.10',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      expect(response.ok).toBe(true)
      if (response.headers.get('set-cookie'))
        cookie = response.headers.get('set-cookie').split(';')[0]
      return response.json()
    }
    try {
      await renderCall('schools')
      await renderCall('register', 'POST', {
        ...initialProfile,
        password: 'Fixture!123',
      })
      await renderCall('login', 'POST', {
        email: initialProfile.email,
        password: 'Fixture!123',
      })
      await renderCall('profile')
      await renderCall('profile', 'PATCH', { first_name: 'Alice' })
      await renderCall('logout', 'POST', {})
      expect(calls[0]).toEqual({
        method: 'GET',
        path: '/service/Schools',
        body: { ip: expectedIp, admin_token: ADMIN_KEY, app_access: APP_KEY },
      })
      expect(calls).toHaveLength(8)
      for (const outgoing of calls) {
        expect(outgoing.body).toMatchObject({
          ip: expectedIp,
          admin_token: ADMIN_KEY,
          app_access: APP_KEY,
        })
      }
      const before = calls.length
      const absent = await fetch(`${renderBase}/api/login`, {
        method: 'POST',
        headers: { Origin: renderBase, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: initialProfile.email,
          password: 'Fixture!123',
        }),
      })
      expect(absent.status).toBe(400)
      expect(calls).toHaveLength(before)
    } finally {
      render.closeAllConnections()
      await new Promise((resolve) => render.close(resolve))
    }
  })

  it('refuses browser-supplied IP and forwarding credentials', async () => {
    for (const extra of [{ ip: '203.0.113.99' }, { admin_token: 'attacker' }]) {
      expect(
        (
          await call('/api/login', 'POST', {
            email: initialProfile.email,
            password: 'Fixture!123',
            ...extra,
          })
        ).status,
      ).toBe(400)
    }
    expect(calls).toHaveLength(0)
  })

  it('requires service login credentials for account writes while leaving public Schools available', async () => {
    const noAdmin = createWebsiteServer({
      backend: `http://127.0.0.1:${upstreamServer.address().port}/service/`,
      appAccess: APP_KEY,
      production: false,
    })
    const localBase = await listen(noAdmin)
    try {
      expect((await fetch(`${localBase}/api/schools`)).status).toBe(200)
      const response = await fetch(`${localBase}/api/login`, {
        method: 'POST',
        headers: { Origin: localBase, 'Content-Type': 'application/json' },
        body: '{}',
      })
      expect(response.status).toBe(503)
      expect(calls).toHaveLength(1)
    } finally {
      noAdmin.closeAllConnections()
      await new Promise((resolve) => noAdmin.close(resolve))
    }
  })

  it('refuses credential-bearing or insecure remote backend URLs', () => {
    expect(() =>
      createWebsiteServer({ backend: 'http://remote.example.com' }),
    ).toThrow('HTTPS')
    expect(() =>
      createWebsiteServer({ backend: 'https://user:pass@remote.example.com' }),
    ).toThrow('without credentials')
  })
})
