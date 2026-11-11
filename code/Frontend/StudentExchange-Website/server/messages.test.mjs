// @vitest-environment node
import http from 'node:http'
import { once } from 'node:events'
import { beforeEach, afterEach, it, expect } from 'vitest'
import { createWebsiteServer } from './app.mjs'
let backend, website, base, cookie, calls, failure
const message = {
  id: 1,
  mine: false,
  kind: 'message',
  text: 'Is this available?',
  amount: null,
  datetime: '2026-11-11T12:00:00',
  read: false,
  access_token: 'private',
}
const conversation = {
  id: 7,
  listing_id: 5,
  listing_title: 'Calculus',
  image_url: '/uploads/0123456789abcdef0123456789abcdef.png',
  role: 'seller',
  other_name: 'Jane Doe',
  last_kind: 'message',
  last_text: 'Is this available?',
  last_amount: null,
  last_datetime: '2026-11-11T12:00:00',
  last_from_me: false,
  unread: 1,
  password: 'private',
}
async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}
beforeEach(async () => {
  calls = []
  failure = null
  backend = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}
    calls.push({ route: req.url, method: req.method, body })
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/LogIn')
      return res.end(
        JSON.stringify({
          access_token:
            body.email === 'service@example.com'
              ? 'service-token'
              : 'visitor-token',
        }),
      )
    if (req.url === '/Admin')
      return res.end(JSON.stringify({ is_admin: true, level: 0 }))
    if (req.url === '/Register')
      return res.end(
        JSON.stringify({
          email: 'buyer@example.com',
          first_name: 'Alex',
          last_name: 'Lee',
          school: 'Campus',
        }),
      )
    if (failure) {
      res.statusCode = failure.status
      return res.end(JSON.stringify(failure.body))
    }
    if (req.url === '/api/Message/unread')
      return res.end(JSON.stringify({ unread: 1, private: 'private' }))
    if (req.url === '/api/Message' && req.method === 'GET')
      return res.end(JSON.stringify([conversation]))
    if (req.url?.startsWith('/api/Message/7?after='))
      return res.end(
        JSON.stringify({
          conversation_id: 7,
          messages: req.url.endsWith('after=0') ? [message] : [],
        }),
      )
    if (req.url === '/api/Message' && req.method === 'POST') {
      res.statusCode = 201
      return res.end(
        JSON.stringify({
          conversation_id: 7,
          Message: 'Message sent.',
          access_token: 'private',
        }),
      )
    }
    res.statusCode = 404
    res.end('{}')
  })
  const upstream = await listen(backend)
  website = createWebsiteServer({
    backend: upstream,
    appAccess: 'app-key',
    user: 'service@example.com',
    userPass: 'Fixture!123',
    production: false,
  })
  base = await listen(website)
  const login = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', password: 'Buyer!123' }),
  })
  cookie = login.headers.get('set-cookie').split(';')[0]
})
afterEach(async () => {
  for (const server of [website, backend]) {
    server?.closeAllConnections()
    if (server) await new Promise((resolve) => server.close(resolve))
  }
})
const get = (path, auth = true) =>
  fetch(`${base}/api/${path}`, { headers: auth ? { Cookie: cookie } : {} })
const send = (body, origin = base) =>
  fetch(`${base}/api/messages`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: origin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
it('requires a session on every messaging route', async () => {
  for (const route of [
    'messages',
    'messages/unread',
    'messages/thread?conversation_id=7',
  ])
    expect((await get(route, false)).status).toBe(401)
  expect(
    calls.filter((row) => row.route.startsWith('/api/Message')),
  ).toHaveLength(0)
})
it('forwards the viewer token and trusted envelope through the api/Message routes and projects responses', async () => {
  const response = await get('messages')
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data.conversations[0].image_url).toMatch(/^\/api\/listing-image/)
  expect(data.conversations[0].password).toBeUndefined()
  expect(calls.findLast((row) => row.route === '/api/Message')).toMatchObject({
    method: 'GET',
    body: {
      access_token: 'visitor-token',
      admin_token: 'service-token',
      app_access: 'app-key',
      ip: '127.0.0.1',
    },
  })
  expect(await (await get('messages/unread')).json()).toEqual({ unread: 1 })
  expect(
    await (await get('messages/thread?conversation_id=7&after=0')).json(),
  ).toEqual({
    conversation_id: 7,
    messages: [
      {
        id: 1,
        mine: false,
        kind: 'message',
        text: 'Is this available?',
        amount: null,
        datetime: '2026-11-11T12:00:00',
        read: false,
      },
    ],
  })
  expect((await get('messages/thread?conversation_id=7&after=1')).status).toBe(
    200,
  )
  expect(calls.at(-1).route).toBe('/api/Message/7?after=1')
})
it('starts by listing and continues by conversation, including real offers', async () => {
  expect((await send({ listing_id: 5, text: '  Hello  ' })).status).toBe(201)
  expect(calls.at(-1)).toMatchObject({
    route: '/api/Message',
    method: 'POST',
    body: {
      listing_id: 5,
      kind: 'message',
      text: 'Hello',
      access_token: 'visitor-token',
    },
  })
  expect(
    (
      await send({
        conversation_id: 7,
        kind: 'offer',
        amount: 12.5,
        text: 'Pickup today?',
      })
    ).status,
  ).toBe(201)
  expect(calls.at(-1).body).toMatchObject({
    conversation_id: 7,
    kind: 'offer',
    amount: 12.5,
  })
  expect(calls.at(-1).body.to_user).toBeUndefined()
})
it('rejects malformed fields, credential injection, ambiguous targets and invalid offers before sending', async () => {
  for (const body of [
    { text: 'missing' },
    { listing_id: 5, conversation_id: 7, text: 'both' },
    { listing_id: -1, text: 'bad' },
    { listing_id: 5, text: ' ' },
    { listing_id: 5, text: 'x'.repeat(1001) },
    { listing_id: 5, text: 'Hi', access_token: 'attack' },
    { listing_id: 5, text: 'Hi', to_user: 'other' },
    { listing_id: 5, kind: 'offer', amount: 0 },
    { listing_id: 5, kind: 'offer', amount: 1000001 },
    { listing_id: 5, kind: 'offer', amount: 1.001 },
    { listing_id: 5, kind: 'message', amount: 12, text: 'Hi' },
  ])
    expect((await send(body)).status).toBe(400)
  expect(
    (await send({ listing_id: 5, text: 'Hi' }, 'https://evil.example')).status,
  ).toBe(403)
  expect(
    calls.filter(
      (row) => row.route === '/api/Message' && row.method === 'POST',
    ),
  ).toHaveLength(0)
  expect((await get('messages/thread?conversation_id=7&after=-1')).status).toBe(
    400,
  )
  expect((await get('messages?to_user=someone')).status).toBe(400)
})
it('preserves not-found and rate-limit responses without retrying writes', async () => {
  failure = { status: 404, body: { Message: 'Conversation not found.' } }
  expect((await get('messages/thread?conversation_id=7')).status).toBe(404)
  failure = {
    status: 429,
    body: {
      Message: 'You are sending messages too quickly. Please wait a minute.',
    },
  }
  const response = await send({ conversation_id: 7, text: 'Hi' })
  expect(response.status).toBe(429)
  expect((await response.json()).message).toContain('wait a minute')
  expect(
    calls.filter(
      (row) => row.route === '/api/Message' && row.method === 'POST',
    ),
  ).toHaveLength(1)
})
