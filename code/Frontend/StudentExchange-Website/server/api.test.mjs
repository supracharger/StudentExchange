// @vitest-environment node
import http from 'node:http'
import { once } from 'node:events'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createWebsiteServer } from './app.mjs'

const APP_KEY = 'fixture-application-key'
const USER_TOKEN = 'fixture-user-token'
const initialProfile = {
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  school: 'University of Colorado Denver',
}
let upstreamServer, website, base, calls, profile, failure

async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}

beforeEach(async () => {
  calls = []
  profile = { ...initialProfile }
  failure = null
  // A real HTTP fixture checks wire behavior, especially the GET body browsers cannot send.
  upstreamServer = http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const text = Buffer.concat(chunks).toString()
    const body = text ? JSON.parse(text) : undefined
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
          Schools: [
            'University of Colorado Denver',
            'Metropolitan State University of Denver',
          ],
        }),
      )
      return
    }
    if (body?.app_access !== APP_KEY) {
      response.writeHead(401)
      response.end(JSON.stringify({ message: 'Not authorized.' }))
      return
    }
    if (request.url === '/service/LogIn' && request.method === 'POST') {
      response.writeHead(201)
      response.end(
        JSON.stringify({ access_token: USER_TOKEN, first_name: 'Jane' }),
      )
      return
    }
    if (request.url === '/service/Register' && request.method === 'POST') {
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
    production: false,
    timeoutMs: 500,
  })
  base = await listen(website)
})

afterEach(async () => {
  for (const server of [website, upstreamServer]) {
    if (!server) continue
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
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
  it('maps the capitalized public Schools response without sending credentials', async () => {
    const response = await call('/api/schools')
    expect(response.status).toBe(200)
    expect((await response.json()).schools).toHaveLength(2)
    expect(calls).toEqual([
      { method: 'GET', path: '/service/Schools', body: undefined },
    ])
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
      body: { app_access: APP_KEY, access_token: USER_TOKEN },
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
    })
    const logout = await call('/api/logout', 'POST', {}, cookie)
    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(calls.at(-1)).toEqual({
      method: 'DELETE',
      path: '/service/LogIn',
      body: { app_access: APP_KEY, access_token: USER_TOKEN },
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
      body: { message: `Rejected ${APP_KEY} Fixture!123` },
    }
    const response = await call('/api/login', 'POST', {
      email: initialProfile.email,
      password: 'Fixture!123',
    })
    expect(response.status).toBe(400)
    const text = await response.text()
    expect(text).not.toContain(APP_KEY)
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
    failure = { path: '/service/Schools', status: 200, body: { Schools: [] } }
    expect(await (await call('/api/schools')).json()).toEqual({ schools: [] })
    failure.body = { Schools: [null] }
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

  it('refuses credential-bearing or insecure remote backend URLs', () => {
    expect(() =>
      createWebsiteServer({ backend: 'http://remote.example.com' }),
    ).toThrow('HTTPS')
    expect(() =>
      createWebsiteServer({ backend: 'https://user:pass@remote.example.com' }),
    ).toThrow('without credentials')
  })
})
