// @vitest-environment node
import http from 'node:http'
import { once } from 'node:events'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { createWebsiteServer } from './app.mjs'

const profile = {
  email: 'admin@example.com',
  first_name: 'Ada',
  last_name: 'Admin',
  school: 'Campus',
}
const target = {
  email: 'student@example.com',
  first_name: 'Sam',
  last_name: 'Student',
  school: 'Campus',
}
const keys = {
  app_access: 'fixture-app',
  admin_token: 'fixture-forwarding',
  access_token: 'fixture-token',
}
const visitor = '198.51.100.27'
let upstream,
  website,
  base,
  calls,
  level,
  isAdmin,
  targetDenied,
  expired,
  badSchema,
  failRead,
  reads
async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}
beforeEach(async () => {
  calls = []
  level = 2
  isAdmin = true
  targetDenied = false
  expired = false
  badSchema = ''
  failRead = false
  reads = 0
  upstream = http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString())
    response.setHeader('Content-Type', 'application/json')
    if (request.url === '/LogIn' && body.email === 'service@example.com') {
      response.writeHead(201)
      response.end(JSON.stringify({ access_token: keys.admin_token }))
      return
    }
    if (request.url === '/Admin' && !body.ip) {
      response.end(JSON.stringify({ is_admin: true, level: 0 }))
      return
    }
    calls.push({ method: request.method, path: request.url, body })
    response.setHeader('Content-Type', 'application/json')
    const send = (status, value) => {
      response.writeHead(status)
      response.end(JSON.stringify(value))
    }
    if (request.url === '/Schools') {
      if (request.method === 'GET') return send(200,
        badSchema === 'schools' ? { schools: ['Campus'], short_names: [] } :
        { schools: ['Campus'], short_names: ['C'], password: 'secret' })
      if (request.method === 'POST') return send(201,
        badSchema === 'school-add' ? {} : { name: body.name, short_name: body.short_name, password: 'secret' })
      return send(200, badSchema === 'school-delete' ? { row_count: '1' } : { row_count: 1, password: 'secret' })
    }
    if (request.url === '/LogIn' && request.method === 'POST')
      return send(201, { access_token: keys.access_token })
    if (expired)
      return send(400, { message: 'The Access Token may have expired.' })
    if (request.url === '/Admin')
      return send(200, {
        is_admin: isAdmin,
        ...(isAdmin ? { level } : {}),
        password: 'secret',
      })
    if (request.url === '/Users')
      return send(
        200,
        badSchema === 'users'
          ? { body: { email: ['x'] } }
          : {
              body: {
                email: [target.email],
                name: ['Student, Sam'],
                school: ['C'],
                datetime: ['2026-10-09T12:00:00'],
                password: ['secret'],
              },
            },
      )
    if (request.url === '/Register' && request.method === 'GET') {
      if (body.to_user && targetDenied)
        return send(401, {
          message:
            'Cannot forward user Admin with equal or greater admin level.',
        })
      if (body.to_user && failRead && ++reads > 1)
        return send(500, { message: 'backend trace' })
      return send(200, {
        ...(body.to_user ? target : profile),
        password: 'secret',
        access_token: 'secret',
      })
    }
    if (request.url === '/Register' && request.method === 'PATCH')
      return send(200, {
        message: 'Saved.',
        email: body.email?.toLowerCase() || body.to_user,
      })
    if (request.url === '/Register' && request.method === 'DELETE') {
      if (
        typeof body.to_user !== 'string' ||
        !body.to_user.trim() ||
        'email' in body
      )
        return send(400, { message: 'Use to_user to select the account.' })
      if (targetDenied)
        return send(401, {
          message:
            'Cannot forward user Admin with equal or greater admin level.',
        })
      return send(200, {
        email: body.to_user,
        deleted_Rows: 1,
        message: 'Deleted.',
      })
    }
    if (request.url === '/Blocked' && request.method === 'GET')
      return send(
        200,
        badSchema === 'blocked'
          ? { blockedUsers: 'bad' }
          : {
              blockedUsers: [
                {
                  email: target.email,
                  name: 'Student, Sam',
                  expiry: '2026-10-09T12:05:00',
                  count: 10,
                  password: 'secret',
                },
              ],
              blockedIPs: [
                {
                  ip: '192.0.2.3',
                  email: target.email,
                  name: 'Student, Sam',
                  expiry: '2026-10-09T12:05:00',
                  count: 3,
                },
              ],
            },
      )
    if (request.url === '/Blocked')
      return send(200, { deleted_Rows: 1, message: 'Cleared.' })
    return send(200, { message: 'Logged out.' })
  })
  const url = await listen(upstream)
  website = createWebsiteServer({
    backend: url,
    appAccess: keys.app_access,
    user: 'service@example.com',
    userPass: 'Service!123',
    renderProxy: true,
    production: false,
  })
  base = await listen(website)
})
afterEach(async () => {
  for (const server of [website, upstream]) {
    server?.closeAllConnections()
    if (server) await new Promise((resolve) => server.close(resolve))
  }
})
async function call(path, method = 'GET', body, cookie, extra = {}) {
  return fetch(`${base}/api/${path}`, {
    method,
    headers: {
      Origin: base,
      'cf-connecting-ip': visitor,
      'x-forwarded-for': '203.0.113.99',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}
async function login() {
  const response = await call('login', 'POST', {
    email: profile.email,
    password: 'Fixture!123',
  })
  expect(response.status).toBe(200)
  return response.headers.get('set-cookie').split(';')[0]
}

describe('administrator wire contract and permissions', () => {
  it('sends the trusted visitor IP on EVERY backend request, including all admin routes and public Schools', async () => {
    const cookie = await login()
    const responses = []
    responses.push(await call('schools'))
    responses.push(await call('admin', 'GET', undefined, cookie))
    responses.push(await call('admin/users', 'GET', undefined, cookie))
    responses.push(
      await call(
        `admin/profile?email=${target.email}`,
        'GET',
        undefined,
        cookie,
      ),
    )
    responses.push(
      await call(
        `admin/profile?email=${target.email}`,
        'PATCH',
        { first_name: 'Alice' },
        cookie,
      ),
    )
    responses.push(
      await call('admin/sessions', 'DELETE', { email: target.email }, cookie),
    )
    responses.push(await call('admin/blocked', 'GET', undefined, cookie))
    responses.push(
      await call('admin/blocked', 'DELETE', { email: target.email }, cookie),
    )
    responses.push(
      await call('admin/blocked', 'DELETE', { ip_addr: '192.0.2.3' }, cookie),
    )
    responses.push(
      await call('admin/users', 'DELETE', { to_user: target.email }, cookie),
    )
    for (const response of responses) expect(response.ok).toBe(true)
    for (const outgoing of calls)
      expect(outgoing.body).toMatchObject({
        ip: visitor,
        admin_token: keys.admin_token,
        app_access: keys.app_access,
      })
    const profileCalls = calls.filter(
      (item) =>
        item.path === '/Register' &&
        item.method !== 'DELETE' &&
        item.body.to_user,
    )
    expect(profileCalls.map((item) => item.method)).toEqual([
      'GET',
      'PATCH',
      'GET',
      'GET',
    ])
    expect(
      calls.find((item) => item.path === '/LogIn' && item.method === 'DELETE')
        .body.to_user,
    ).toBe(target.email)
    expect(
      calls.find(
        (item) => item.path === '/Register' && item.method === 'DELETE',
      ).body,
    ).toMatchObject({ to_user: target.email })
    expect(
      calls.find(
        (item) => item.path === '/Register' && item.method === 'DELETE',
      ).body,
    ).not.toHaveProperty('email')
    for (const response of responses)
      expect(JSON.stringify(await response.json())).not.toMatch(
        /fixture-token|fixture-forwarding|fixture-app|password/,
      )
  })
  it('requires the new deletion selector, rejects legacy email, and preserves exact target values', async () => {
    const cookie = await login()
    for (const body of [
      { email: target.email },
      {},
      { to_user: '' },
      { to_user: 42 },
      { to_user: target.email, email: target.email },
    ]) {
      const before = calls.length
      expect((await call('admin/users', 'DELETE', body, cookie)).status).toBe(
        400,
      )
      expect(calls.slice(before).map((item) => item.path)).toEqual(['/Admin'])
    }
    const exact = 'Exact@Example.com'
    expect(
      (await call('admin/users', 'DELETE', { to_user: exact }, cookie)).status,
    ).toBe(200)
    expect(calls.at(-1).body).toMatchObject({
      to_user: exact,
      ip: visitor,
      admin_token: keys.admin_token,
      access_token: keys.access_token,
    })
    expect(calls.at(-1).body).not.toHaveProperty('email')
  })
  it('lists, adds, and deletes schools with visitor credentials and the Schools response schema', async () => {
    const cookie = await login()
    level = 1
    const directory = await call('admin/schools', 'GET', undefined, cookie)
    expect(await directory.json()).toEqual({ schools: [{ name: 'Campus', short_name: 'C' }] })
    const school = { name: 'New Campus', short_name: ' NC ' }
    const added = await call('admin/schools', 'POST', school, cookie)
    expect(added.status).toBe(201)
    expect(await added.json()).toEqual({ message: 'School added.', ...school })
    expect(calls.at(-1)).toEqual({ path: '/Schools', method: 'POST', body: {
      ...school, access_token: keys.access_token, admin_token: keys.admin_token, app_access: keys.app_access, ip: visitor,
    } })
    for (const selector of [school, { name: school.name }, { short_name: school.short_name }]) {
      const removed = await call('admin/schools', 'DELETE', selector, cookie)
      expect(await removed.json()).toEqual({ message: 'School deleted.', deletedRows: 1 })
      expect(calls.at(-1).body).toMatchObject(selector)
    }
  })
  it('blocks school mutations for level 0, demoted callers, and injected or blank fields', async () => {
    expect((await call('admin/schools', 'POST', { name: 'Campus', short_name: 'C' })).status).toBe(401)
    const cookie = await login()
    level = 0
    for (const method of ['GET', 'POST', 'DELETE']) {
      const before = calls.length
      expect((await call('admin/schools', method, method === 'GET' ? undefined : { name: 'Campus', short_name: 'C' }, cookie)).status).toBe(403)
      expect(calls.slice(before).map(item => item.path)).toEqual(['/Admin'])
    }
    level = 1
    for (const [method, body] of [
      ['POST', { name: 'Campus' }], ['POST', { name: ' ', short_name: 'C' }],
      ['POST', { name: 'Campus', short_name: 3 }], ['DELETE', {}],
      ['DELETE', { name: null }], ['DELETE', { name: 'Campus', admin_token: 'evil' }],
      ['POST', { name: 'Campus', short_name: 'C', access_token: 'evil' }],
    ]) {
      const before = calls.length
      expect((await call('admin/schools', method, body, cookie)).status).toBe(400)
      expect(calls.slice(before).map(item => item.path)).toEqual(['/Admin'])
    }
    isAdmin = false
    expect((await call('admin/schools', 'DELETE', { name: 'Campus' }, cookie)).status).toBe(403)
  })
  it('rejects malformed school directory and action responses', async () => {
    const cookie = await login()
    for (const [schema, method] of [['schools', 'GET'], ['school-add', 'POST'], ['school-delete', 'DELETE']]) {
      badSchema = schema
      expect((await call('admin/schools', method, method === 'GET' ? undefined : { name: 'Campus', short_name: 'C' }, cookie)).status).toBe(502)
    }
  })
  it('reports exact level permissions and rechecks demotions before protected upstream actions', async () => {
    const cookie = await login()
    for (const [rank, membership, expected] of [
      [0, false, [false, false, false]],
      [0, true, [false, false, true]],
      [1, true, [true, false, true]],
      [2, true, [true, true, true]],
    ]) {
      level = rank
      isAdmin = membership
      const status = await (
        await call('admin', 'GET', undefined, cookie)
      ).json()
      expect([
        status.permissions.users,
        status.permissions.blocked,
        status.permissions.endSessions,
      ]).toEqual(expected)
    }
    level = 1
    const before = calls.length
    expect((await call('admin/blocked', 'GET', undefined, cookie)).status).toBe(
      403,
    )
    expect(calls.slice(before).map((item) => item.path)).toEqual(['/Admin'])
    level = 0
    expect(
      (await call('admin/users', 'DELETE', { to_user: target.email }, cookie))
        .status,
    ).toBe(403)
    expect(
      (
        await call(
          `admin/profile?email=${target.email}`,
          'PATCH',
          { first_name: 'Sam' },
          cookie,
        )
      ).status,
    ).toBe(403)
    expect(
      (await call('admin/sessions', 'DELETE', { email: target.email }, cookie))
        .status,
    ).toBe(200)
    isAdmin = false
    expect(
      (await call('admin/sessions', 'DELETE', { email: target.email }, cookie))
        .status,
    ).toBe(403)
  })
  it('does not contact the backend when unsigned or when credentials/forwarding fields are injected', async () => {
    expect((await call('admin/users')).status).toBe(401)
    expect(calls).toHaveLength(0)
    const cookie = await login()
    for (const injection of [
      { ip: '203.0.113.22' },
      { admin_token: 'evil' },
      { access_token: 'evil' },
      { app_access: 'evil' },
      { email: target.email },
    ]) {
      const before = calls.length
      expect(
        (
          await call(
            'admin/users',
            'DELETE',
            { to_user: target.email, ...injection },
            cookie,
          )
        ).status,
      ).toBe(400)
      expect(calls.slice(before).map((item) => item.path)).toEqual(['/Admin'])
    }
    expect(
      (
        await call(
          'admin/blocked',
          'DELETE',
          { email: target.email, ip_addr: '192.0.2.3' },
          cookie,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await call('admin/users', 'DELETE', { to_user: target.email }, cookie, {
          Origin: 'https://attacker.example',
        })
      ).status,
    ).toBe(403)
  })
  it('preserves the caller session for a forbidden target, but expires invalid tokens', async () => {
    const cookie = await login()
    targetDenied = true
    const forbidden = await call(
      `admin/profile?email=${target.email}`,
      'GET',
      undefined,
      cookie,
    )
    expect(forbidden.status).toBe(403)
    expect(forbidden.headers.get('set-cookie')).toBeNull()
    const beforeDeletion = calls.length
    expect(
      (await call('admin/users', 'DELETE', { to_user: target.email }, cookie))
        .status,
    ).toBe(403)
    expect(calls.slice(beforeDeletion).at(-1).body.to_user).toBe(target.email)
    const beforeLogout = calls.length
    expect(
      (await call('admin/sessions', 'DELETE', { email: target.email }, cookie))
        .status,
    ).toBe(403)
    expect(
      calls.slice(beforeLogout).some((item) => item.path === '/LogIn'),
    ).toBe(false)
    expect((await call('admin', 'GET', undefined, cookie)).status).toBe(200)
    expired = true
    const response = await call('admin', 'GET', undefined, cookie)
    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })
  it('projects columns and attempt rows, handles empty lists, and rejects malformed schemas', async () => {
    const cookie = await login()
    const users = await (
      await call('admin/users', 'GET', undefined, cookie)
    ).json()
    expect(users.users).toEqual([
      {
        email: target.email,
        name: 'Student, Sam',
        school: 'C',
        datetime: '2026-10-09T12:00:00',
      },
    ])
    const records = await (
      await call('admin/blocked', 'GET', undefined, cookie)
    ).json()
    expect(records.blockedUsers[0]).not.toHaveProperty('password')
    badSchema = 'users'
    expect((await call('admin/users', 'GET', undefined, cookie)).status).toBe(
      502,
    )
    badSchema = 'blocked'
    expect((await call('admin/blocked', 'GET', undefined, cookie)).status).toBe(
      502,
    )
  })
  it('preserves exact selectors and reports successful writes even if the follow-up profile read fails', async () => {
    const cookie = await login()
    failRead = true
    reads = 1
    const response = await call(
      `admin/profile?email=${encodeURIComponent('Exact@Example.com')}`,
      'PATCH',
      { email: 'Updated@Example.com', password: 'Changed!123' },
      cookie,
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.profile).toBeNull()
    expect(data.message).toContain('Changes saved')
    expect(calls.find((item) => item.method === 'PATCH').body.to_user).toBe(
      'Exact@Example.com',
    )
    expect(calls.at(-1).body.to_user).toBe('updated@example.com')
    // Editable email normalization is backend-owned; update reads need the normalized selector.
  })
})
