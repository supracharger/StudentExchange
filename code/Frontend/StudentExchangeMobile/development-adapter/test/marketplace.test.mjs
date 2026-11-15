import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { createWebsiteServer } from '../server/app.mjs'
import { backendUrl, createApplicationClient, upstream } from '../server/api.mjs'
import { createMockBackend } from '../server/mock-backend.mjs'
import { marketplaceResponse } from '../server/marketplace.mjs'

async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}
test('local HTTP integration preserves GET bodies and protects the security envelope', async t => {
  const mock = createMockBackend()
  const backend = await listen(mock)
  const calls = []
  mock.prependListener('request', req => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => calls.push([req.method, req.url, JSON.parse(Buffer.concat(chunks).toString())]))
  })
  const adapter = createWebsiteServer({ backend, appAccess: 'mock-app-only', production: false, timeoutMs: 500 })
  const base = await listen(adapter)
  t.after(() => { adapter.closeAllConnections(); adapter.close(); mock.closeAllConnections(); mock.close() })
  const get = path => fetch(base + path)
  let response = await get('/api/listings?search=calculus&category=Textbooks')
  assert.equal(response.status, 200)
  const items = await response.json()
  assert.equal(items[0].title, 'Mock calculus textbook')
  assert.equal(JSON.stringify(items).includes('mock-app-only'), false)
  assert.deepEqual(await (await get('/api/listings?category=Electronics')).json(), [])
  assert.deepEqual(await (await get('/api/categories')).json(), ['Textbooks', 'Electronics'])
  assert.deepEqual(await (await get('/api/conditions')).json(), ['New', 'Good'])
  const detail = await (await get('/api/listings/1')).json()
  assert.equal(detail.first_name, 'Mock')
  assert.equal('email' in detail, false)
  assert.deepEqual(detail.images_url, [])
  assert.equal((await get('/api/listings/99')).status, 400)
  for (const query of ['app_access=bad', 'access_token=bad', 'ip=bad', 'admin_token=bad', 'for_user=x', 'category=a&category=b', 'unknown=x'])
    assert.equal((await get('/api/listings?' + query)).status, 400)
  for (const method of ['PATCH', 'PUT', 'DELETE'])
    assert.equal((await fetch(base + '/api/listings', { method })).status, 405)
  assert.equal((await get('/api/profile')).status, 401)
  assert.equal((await fetch(base + '/api/login', { method: 'POST' })).status, 403)
  assert.equal((await get('/api/message')).status, 404)
  assert.ok(calls.some(([verb, path]) => verb === 'GET' && path === '/Listing'))
  assert.ok(calls.every(([verb]) => verb === 'GET'))
  for (const [, , body] of calls) {
    assert.equal(body.app_access, 'mock-app-only')
    assert.equal('ip' in body, false)
    assert.equal('admin_token' in body, false)
    assert.equal('access_token' in body, false)
  }
  const listingBody = calls.find(([, path]) => path === '/Listing')[2]
  assert.equal(listingBody.search, 'calculus')
  assert.equal(listingBody.category, 'Textbooks')
  mock.closeAllConnections()
  await new Promise(resolve => mock.close(resolve))
  assert.equal((await get('/api/listings')).status, 502)
})
test('development guard rejects nonlocal upstreams and malformed backend payloads', () => {
  assert.throws(() => backendUrl('https://example.com/'), /mock backend/)
  assert.throws(() => backendUrl('http://localhost/'), /mock backend/)
  assert.throws(() => marketplaceResponse('listings', {}))
  assert.throws(() => marketplaceResponse('names', [123]))
  assert.throws(() => marketplaceResponse('listings', [{ title: 'missing fields' }]))
})


test('application envelope preserves user tokens and rejects forwarding fields before transport', async t => {
  const bodies = []
  const mock = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    bodies.push(JSON.parse(Buffer.concat(chunks).toString()))
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}')
  })
  const backend = await listen(mock)
  t.after(() => { mock.closeAllConnections(); mock.close() })
  const client = createApplicationClient({ backend, appAccess: 'test-server-secret' })
  await client.call('Register', 'GET', { access_token: 'test-user-token' })
  assert.deepEqual(bodies, [{ access_token: 'test-user-token', app_access: 'test-server-secret' }])
  for (const key of ['ip', 'admin_token', 'app_access'])
    await assert.rejects(client.call('Listing', 'GET', { [key]: 'injected' }), /unsupported authentication field/)
  for (const key of ['ip', 'admin_token'])
    assert.throws(() => upstream(backend, 'Listing', 'GET', { [key]: 'injected' }), /Forwarding fields/)
  assert.equal(bodies.length, 1)
  await assert.rejects(createApplicationClient({ backend }).call('Listing', 'GET'), /unavailable/)
})
