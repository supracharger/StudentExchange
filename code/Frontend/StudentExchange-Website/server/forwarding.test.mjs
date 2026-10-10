// @vitest-environment node
import http from 'node:http'
import { once } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createForwardingClient } from './api.mjs'

let server, config, calls, generation, mode, expired, rejectRetry
beforeEach(async () => {
  calls = []
  generation = 0
  mode = 'admin'
  expired = false
  rejectRetry = false
  server = http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString())
    calls.push({ route: request.url, method: request.method, body })
    const send = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(data))
    }
    if (request.url === '/LogIn') {
      if (mode === 'bad-login') return send(400, { message: 'service@example.com Service!123' })
      return send(201, mode === 'malformed' ? {} : { access_token: `service-token-${++generation}` })
    }
    if (request.url === '/Admin') return send(200, { is_admin: mode !== 'regular', level: 0 })
    if (expired && (body.admin_token === 'service-token-1' || rejectRetry))
      return send(400, { message: 'The Access Token may have expired.', expired: true })
    if (mode === 'visitor-expired') return send(400, { message: 'The Access Token may have expired.' })
    if (mode === 'forbidden') return send(401, { message: 'Not authorized.' })
    if (mode === 'server-error') return send(500, { message: 'internal exception' })
    return send(200, { success: true })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  config = { backend: `http://127.0.0.1:${server.address().port}`, appAccess: 'app-key', user: 'service@example.com', userPass: 'Service!123' }
})
afterEach(async () => {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
})
const visitorIp = '198.51.100.27'

it('logs in at initialization without forwarding, verifies admin, and reuses the token', async () => {
  const service = createForwardingClient(config)
  await vi.waitFor(() => expect(calls).toHaveLength(2))
  expect(calls[0]).toEqual({ route: '/LogIn', method: 'POST', body: { app_access: 'app-key', email: config.user, password: config.userPass } })
  expect(calls[1].body).toEqual({ app_access: 'app-key', access_token: 'service-token-1' })
  await service.call('Register', 'GET', { access_token: 'visitor-token' }, visitorIp)
  await service.call('Schools', 'GET', {}, visitorIp)
  expect(generation).toBe(1)
  expect(calls[2].body).toEqual({ access_token: 'visitor-token', app_access: 'app-key', admin_token: 'service-token-1', ip: visitorIp })
})

it('retries an expired forwarding token once, preserving operation fields and visitor token', async () => {
  const service = createForwardingClient(config)
  await service.call('Schools', 'GET', {}, visitorIp)
  expired = true
  await service.call('Register', 'PATCH', { access_token: 'visitor-token', first_name: 'Sam' }, visitorIp)
  const writes = calls.filter(c => c.method === 'PATCH')
  expect(writes).toHaveLength(2)
  expect(writes[1].body).toEqual({ ...writes[0].body, admin_token: 'service-token-2' })
  expect(generation).toBe(2)
})

it('shares one refresh across concurrent requests rejected with the old token', async () => {
  const service = createForwardingClient(config)
  await service.call('Schools', 'GET', {}, visitorIp)
  expired = true
  await Promise.all(Array.from({ length: 6 }, () => service.call('Register', 'GET', { access_token: 'visitor-token' }, visitorIp)))
  expect(generation).toBe(2)
  expect(calls.filter(c => c.body.admin_token === 'service-token-2')).toHaveLength(6)
})

it('bounds retries and keeps forwarding expiry separate from visitor expiry', async () => {
  const service = createForwardingClient(config)
  await service.call('Schools', 'GET', {}, visitorIp)
  expired = rejectRetry = true
  await expect(service.call('Register', 'DELETE', { access_token: 'visitor-token', to_user: 'target@example.com' }, visitorIp)).rejects.toMatchObject({ status: 503 })
  expect(calls.filter(c => c.method === 'DELETE')).toHaveLength(2)
})

it.each(['visitor-expired', 'forbidden', 'server-error'])('does not retry %s errors', async failure => {
  const service = createForwardingClient(config)
  await service.call('Schools', 'GET', {}, visitorIp)
  mode = failure
  await expect(service.call('Register', 'GET', { access_token: 'visitor-token' }, visitorIp)).rejects.toMatchObject({ status: failure === 'server-error' ? 502 : 401 })
  expect(generation).toBe(1)
  expect(calls.filter(c => c.route === '/Register')).toHaveLength(1)
})

it.each(['regular', 'malformed', 'bad-login'])('fails safely for a %s service account', async failure => {
  mode = failure
  const service = createForwardingClient(config)
  await expect(service.call('Register', 'GET', {}, visitorIp)).rejects.toMatchObject({ status: 503, message: 'Accounts are temporarily unavailable. Please try again later.' })
  expect(calls.some(c => c.route === '/Register')).toBe(false)
})


it('recovers from an unavailable startup login on the next request', async () => {
  mode = 'bad-login'
  const service = createForwardingClient(config)
  await expect(service.call('Register', 'GET', {}, visitorIp)).rejects.toMatchObject({ status: 503 })
  mode = 'admin'
  await expect(service.call('Register', 'GET', {}, visitorIp)).resolves.toEqual({ success: true })
  expect(generation).toBe(1)
})

it('never uses the former admin_token config as a forwarding password', async () => {
  const service = createForwardingClient({ backend: config.backend, appAccess: config.appAccess, adminToken: 'legacy-password' })
  await expect(service.call('Register', 'GET', {}, visitorIp)).rejects.toMatchObject({ status: 503 })
  expect(calls).toHaveLength(0)
  await service.call('Schools', 'GET', {}, visitorIp)
  expect(calls[0].body).toEqual({ app_access: 'app-key', ip: visitorIp })
})
