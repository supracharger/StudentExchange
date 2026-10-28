// @vitest-environment node
import http from 'node:http'
import { once } from 'node:events'
import { beforeEach, afterEach, expect, it } from 'vitest'
import { createWebsiteServer } from './app.mjs'
import { validIsbn } from './marketplace.mjs'
let fixture, site, base, calls, level, rows, cookie, failTarget
const listing = {
  id: 5,
  title: 'A textbook',
  price: 0,
  category: 'Textbooks',
  condition: 'Good',
  description: 'Useful',
  email: 'seller@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  location: '',
  isbn: null,
  image_url: '/uploads/0123456789abcdef0123456789abcdef.png',
  datetime: '2026-10-27T10:00:00',
  status: 'Active',
  access_token: 'must-not-leak',
}
async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}
beforeEach(async () => {
  calls = []
  level = 30
  rows = [listing]
  failTarget = false
  fixture = http.createServer(async (req, res) => {
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
      return res.end(
        JSON.stringify({
          is_admin: body.access_token === 'service-token' || level >= 0,
          level: body.access_token === 'service-token' ? 0 : level,
        }),
      )
    if (req.url === '/Register')
      return res.end(
        JSON.stringify({
          email: 'seller@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
          school: 'Campus',
        }),
      )
    if (req.url === '/Category')
      return res.end(
        JSON.stringify(
          req.method === 'GET'
            ? ['Textbooks', 'Electronics']
            : { category: body.category },
        ),
      )
    if (req.url === '/Condition')
      return res.end(JSON.stringify(['Good', 'Like New']))
    if (req.url === '/Listing') {
      if (failTarget && body.to_user) {
        res.statusCode = 401
        return res.end(
          JSON.stringify({
            message:
              'Cannot forward user Admin with equal or greater admin level.',
          }),
        )
      }
      if (req.method === 'GET') return res.end(JSON.stringify(rows))
      res.statusCode = req.method === 'POST' ? 201 : 200
      return res.end(JSON.stringify({ message: 'Success' }))
    }
    if (req.url.startsWith('/uploads/')) {
      res.setHeader('Content-Type', 'image/png')
      return res.end(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]))
    }
    res.statusCode = 404
    res.end('{}')
  })
  const upstream = await listen(fixture)
  site = createWebsiteServer({
    backend: upstream,
    appAccess: 'fixture-app',
    user: 'service@example.com',
    userPass: 'fixture-pass',
    production: false,
  })
  base = await listen(site)
  const response = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({
      email: 'seller@example.com',
      password: 'Fixture!123',
    }),
  })
  cookie = response.headers.get('set-cookie').split(';')[0]
})
afterEach(async () => {
  for (const s of [site, fixture]) {
    s?.closeAllConnections()
    if (s) await new Promise((resolve) => s.close(resolve))
  }
})
const get = (path, loggedIn = true) =>
  fetch(`${base}/api/${path}`, { headers: loggedIn ? { Cookie: cookie } : {} })
const write = (path, method, body, origin = base) =>
  fetch(`${base}/api/${path}`, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
it('keeps public search unauthenticated, preserves relevance order, and projects safe images and fields', async () => {
  rows = [{ ...listing, id: 9 }, listing]
  const res = await get(
    'listings?search=calclus&category=Textbooks&isbn=9780131103627',
    false,
  )
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.listings.map((x) => x.id)).toEqual([9, 5])
  expect(data.listings[0].image_url).toBe(
    '/api/listing-image?name=0123456789abcdef0123456789abcdef.png',
  )
  expect(data.listings[0].access_token).toBeUndefined()
  const call = calls.findLast((x) => x.route === '/Listing')
  expect(call.body).toMatchObject({
    search: 'calclus',
    category: 'Textbooks',
    isbn: '9780131103627',
    admin_token: 'service-token',
    app_access: 'fixture-app',
    ip: '127.0.0.1',
  })
  expect(call.body.access_token).toBeUndefined()
})
it('loads live categories and conditions', async () => {
  expect(await (await get('catalog', false)).json()).toEqual({
    categories: ['Textbooks', 'Electronics'],
    conditions: ['Good', 'Like New'],
  })
})
it('uses the visitor token and for_user marker for seller inventory without forwarding an arbitrary owner', async () => {
  expect((await get('seller/listings')).status).toBe(200)
  expect(calls.findLast((x) => x.route === '/Listing').body).toMatchObject({
    access_token: 'visitor-token',
    for_user: 'true',
  })
  expect((await get('seller/listings?email=other@example.com')).status).toBe(
    400,
  )
  expect((await get('seller/listings', false)).status).toBe(401)
})
it('creates a free listing and accepts valid base64 images larger than the account body limit', async () => {
  const image = Buffer.alloc(20000)
  image.set([137, 80, 78, 71])
  const res = await write('seller/listings', 'POST', {
    title: 'Free book',
    description: 'Read it',
    price: 0,
    category: 'Textbooks',
    condition: 'Good',
    isbn: '978-0-13-110362-7',
    imageBase64: image.toString('base64'),
  })
  expect(res.status).toBe(201)
  expect(calls.findLast((x) => x.route === '/Listing').body).toMatchObject({
    price: 0,
    title: 'Free book',
    access_token: 'visitor-token',
  })
})
it('validates money, ISBN, image types, and field injection before mutation', async () => {
  const draft = {
    title: 'Book',
    price: 10,
    category: 'Textbooks',
    condition: 'Good',
  }
  for (const extra of [
    { price: -1 },
    { price: 1.001 },
    { isbn: '9780131103628' },
    { category: 'Electronics', isbn: '9780131103627' },
    { access_token: 'attack' },
    { to_user: 'other@example.com' },
    { imageBase64: Buffer.alloc(12).toString('base64') },
    { title: ' '.repeat(5) },
  ])
    expect(
      (await write('seller/listings', 'POST', { ...draft, ...extra })).status,
    ).toBe(400)
  expect(
    calls.filter((x) => x.route === '/Listing' && x.method === 'POST'),
  ).toHaveLength(0)
})
it('checks CSRF origin and deletion IDs', async () => {
  expect(
    (
      await write(
        'seller/listings',
        'DELETE',
        { id: 5 },
        'https://evil.example',
      )
    ).status,
  ).toBe(403)
  expect((await write('seller/listings', 'DELETE', { id: -1 })).status).toBe(
    400,
  )
  expect((await write('seller/listings', 'DELETE', { id: 5 })).status).toBe(200)
  expect(calls.findLast((x) => x.route === '/Listing').body).toMatchObject({
    id: 5,
    access_token: 'visitor-token',
  })
})
it('authorizes admin operations afresh and forwards exact target email', async () => {
  const email = 'Other@example.com'
  expect(
    (await get(`admin/listings?email=${encodeURIComponent(email)}`)).status,
  ).toBe(200)
  expect(calls.findLast((x) => x.route === '/Listing').body).toMatchObject({
    for_user: 'true',
    to_user: email,
    access_token: 'visitor-token',
  })
  level = 9
  expect(
    (await write(`admin/listings?email=${email}`, 'DELETE', { id: 5 })).status,
  ).toBe(403)
  expect(
    (await write('admin/categories', 'POST', { category: 'Furniture' })).status,
  ).toBe(403)
  level = 10
  expect(
    (await write('admin/categories', 'POST', { category: 'Furniture' })).status,
  ).toBe(201)
  expect(
    (await write(`admin/listings?email=${email}`, 'DELETE', { id: 5 })).status,
  ).toBe(200)
})
it('preserves admin sessions when a target is forbidden', async () => {
  failTarget = true
  expect((await get('admin/listings?email=other@example.com')).status).toBe(403)
  expect((await get('profile')).status).toBe(200)
})
it('rejects malformed responses and arbitrary remote image URLs', async () => {
  rows = [{ ...listing, image_url: 'https://evil.example/photo.png' }]
  expect(
    (await (await get('listings')).json()).listings[0].image_url,
  ).toBeNull()
  rows = { bad: [] }
  expect((await get('listings')).status).toBe(502)
})
it('serves bounded same-origin images and rejects path traversal', async () => {
  const res = await get(
    'listing-image?name=0123456789abcdef0123456789abcdef.png',
    false,
  )
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('image/png')
  expect((await get('listing-image?name=../secret', false)).status).toBe(400)
})
it('accepts ISBN-10 X and ISBN-13 check digits', () => {
  expect(validIsbn('0-8044-2957-X')).toBe(true)
  expect(validIsbn('9780131103627')).toBe(true)
  expect(validIsbn('9780131103628')).toBe(false)
  expect(validIsbn('123')).toBe(false)
})
