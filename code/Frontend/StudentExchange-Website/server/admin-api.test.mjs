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
  level = 20
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
    if (request.url === '/Admin' && request.method !== 'GET') {
      if (targetDenied) return send(401, { message: 'Target is forbidden.' })
      return send(request.method === 'POST' ? 201 : 200, { email: body.to_user, access_token: 'secret' })
    }
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
                isAdmin: [0],
                locked: [0],
                ...(level >= 27 ? { level: [-1] } : {}),
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
                  count: badSchema === 'successful-records' ? -1 : 10,
                  password: 'secret',
                },
              ],
              blockedIPs: [
                {
                  ip: '192.0.2.3',
                  users: [
                    { email: target.email, name: 'Student, Sam', password: 'secret' },
                    { email: 'second@example.com', name: 'Student, Second', access_token: 'secret' },
                  ],
                  expiry: '2026-10-09T12:05:00',
                  count: badSchema === 'successful-records' ? -1 : 3,
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
    level = 10
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
    level = 10
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
  it('grants, updates, and removes admin access using the visitor token and exact target selector', async () => {
    const cookie = await login()
    level = 30
    for (const [method, fields] of [
      ['POST', { to_user: 'Exact@Example.com', level: 10, locked: 1 }],
      ['PATCH', { to_user: 'Exact@Example.com', level: 0, locked: 0 }],
      ['DELETE', { to_user: 'Exact@Example.com' }],
    ]) {
      const response = await call('admin', method, fields, cookie)
      expect(response.status).toBe(method === 'POST' ? 201 : 200)
      expect(await response.json()).toEqual({ email: fields.to_user, message: method === 'POST' ? 'Admin access granted.' : method === 'PATCH' ? 'Admin access updated.' : 'Admin access removed.' })
      expect(calls.at(-1)).toEqual({ path: '/Admin', method, body: {
        ...fields, access_token: keys.access_token, admin_token: keys.admin_token, app_access: keys.app_access, ip: visitor,
      } })
    }
  })
  it('checks admin assignment bounds and locked privilege before sending mutations', async () => {
    const cookie = await login()
    level = 0
    expect((await call('admin', 'POST', { to_user: target.email, level: 0 }, cookie)).status).toBe(403)
    level = 1
    expect((await call('admin', 'POST', { to_user: target.email, level: 0 }, cookie)).status).toBe(201)
    level = 29
    for (const fields of [
      { to_user: target.email, level: 29 }, { to_user: target.email, level: -1 },
      { to_user: target.email, level: 0.5 }, { to_user: target.email, level: '10' },
      { to_user: target.email }, { to_user: target.email, level: 10, access_token: 'evil' },
    ]) {
      const before = calls.length
      expect((await call('admin', 'PATCH', fields, cookie)).status).toBe(400)
      expect(calls.slice(before).map(item => item.method)).toEqual(['GET'])
    }
    expect((await call('admin', 'PATCH', { to_user: target.email, level: 10, locked: 0 }, cookie)).status).toBe(403)
    level = 30
    expect((await call('admin', 'POST', { to_user: target.email, level: 10, locked: true }, cookie)).status).toBe(400)
    expect((await call('admin', 'DELETE', { to_user: target.email, level: 10 }, cookie)).status).toBe(400)
    targetDenied = true
    expect((await call('admin', 'DELETE', { to_user: target.email }, cookie)).status).toBe(403)
    expect((await call('admin', 'GET', undefined, cookie)).status).toBe(200)
  })
  it('shows directory flags at all permitted levels and reveals levels at 27 while locking requires 30', async () => {
    const cookie = await login()
    level = 20
    const lower = await (await call('admin/users', 'GET', undefined, cookie)).json()
    expect(lower.users[0]).toMatchObject({ isAdmin: false, locked: false })
    expect(lower.users[0]).not.toHaveProperty('level')
    level = 27
    const middle = await (await call('admin/users', 'GET', undefined, cookie)).json()
    expect(middle.users[0]).toHaveProperty('level', null)
    const middleStatus = await (await call('admin', 'GET', undefined, cookie)).json()
    expect(middleStatus.permissions).toMatchObject({ viewAdminLevels: true, lockAdmins: false })
    level = 30
    const higher = await (await call('admin/users', 'GET', undefined, cookie)).json()
    expect(higher.users[0]).toHaveProperty('level', null)
    const status = await (await call('admin', 'GET', undefined, cookie)).json()
    expect(status.permissions).toMatchObject({ manageAdmins: true, lockAdmins: true, viewAdminLevels: true })
  })
  it('reports exact level permissions and rechecks demotions before protected upstream actions', async () => {
    const cookie = await login()
    for (const [rank, membership, expected] of [
      [0, false, [false, false, false]],
      [0, true, [false, false, true]],
      [1, true, [false, false, true]],
      [2, true, [false, false, true]],
      [9, true, [false, false, true]],
      [10, true, [true, false, true]],
      [19, true, [true, false, true]],
      [20, true, [true, true, true]],
    ]) {
      level = rank
      isAdmin = membership
      const status = await (
        await call('admin', 'GET', undefined, cookie)
      ).json()
      expect(status.level).toBe(membership ? rank : null)
      expect(status.permissions.schools).toBe(membership && rank >= 10)
      expect(status.permissions.profiles).toBe(membership && rank >= 10)
      expect(status.permissions.deleteUsers).toBe(membership && rank >= 10)
      expect([
        status.permissions.users,
        status.permissions.blocked,
        status.permissions.endSessions,
      ]).toEqual(expected)
    }
    level = 10
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
  it('enforces the new thresholds immediately below levels 10 and 20', async () => {
    const cookie = await login()
    level = 9
    for (const [path, method, body] of [
      ['admin/users', 'GET', undefined],
      ['admin/schools', 'POST', { name: 'Campus', short_name: 'C' }],
      ['admin/schools', 'DELETE', { name: 'Campus' }],
      ['admin/users', 'DELETE', { to_user: target.email }],
      [`admin/profile?email=${target.email}`, 'GET', undefined],
      [`admin/profile?email=${target.email}`, 'PATCH', { first_name: 'Sam' }],
    ]) {
      const before = calls.length
      expect((await call(path, method, body, cookie)).status).toBe(403)
      expect(calls.slice(before).map(item => item.path)).toEqual(['/Admin'])
    }
    level = 19
    for (const method of ['GET', 'DELETE']) {
      const before = calls.length
      expect((await call('admin/blocked', method, method === 'GET' ? undefined : { email: target.email }, cookie)).status).toBe(403)
      expect(calls.slice(before).map(item => item.path)).toEqual(['/Admin'])
    }
    level = 20
    expect((await call('admin/blocked', 'GET', undefined, cookie)).status).toBe(200)
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
        isAdmin: false, locked: false,
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
    expect(records.blockedIPs).toEqual([{
      ip: '192.0.2.3', expiry: '2026-10-09T12:05:00', count: 3,
      users: [
        { email: target.email, name: 'Student, Sam' },
        { email: 'second@example.com', name: 'Student, Second' },
      ],
    }])
    badSchema = 'users'
    expect((await call('admin/users', 'GET', undefined, cookie)).status).toBe(
      502,
    )
    badSchema = 'blocked'
    expect((await call('admin/blocked', 'GET', undefined, cookie)).status).toBe(
      502,
    )
  })
  it('returns successful user and IP records without rejecting or filtering them', async () => {
    const cookie = await login()
    badSchema = 'successful-records'
    const response = await call('admin/blocked', 'GET', undefined, cookie)
    expect(response.status).toBe(200)
    const records = await response.json()
    expect(records.blockedUsers).toHaveLength(1)
    expect(records.blockedUsers[0].count).toBe(-1)
    expect(records.blockedIPs).toHaveLength(1)
    expect(records.blockedIPs[0].count).toBe(-1)
    expect(records.blockedIPs[0].users).toHaveLength(2)
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
