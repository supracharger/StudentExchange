// @vitest-environment node
import http from 'node:http'
import { once } from 'node:events'
import { expect, it, vi } from 'vitest'
import { createWebsiteServer } from './app.mjs'

it('waits through a backend cold start, then finishes service authentication and school lookup', async () => {
  const deadline = vi.spyOn(AbortSignal, 'timeout')
  const calls = []
  const backend = http.createServer(async (request, response) => {
    for await (const _chunk of request) { /* Drain the forwarded body. */ }
    calls.push(request.url)
    if (request.url === '/LogIn') {
      // Exceeds the old 15-second adapter deadline, including its startup login.
      await new Promise(resolve => setTimeout(resolve, 16000))
      response.end(JSON.stringify({ access_token: 'fixture-service-token' }))
    } else if (request.url === '/Admin') {
      response.end(JSON.stringify({ is_admin: true }))
    } else {
      response.end(JSON.stringify({ schools: ['Fixture University'] }))
    }
  })
  let website
  try {
    backend.listen(0, '127.0.0.1')
    await once(backend, 'listening')
    website = createWebsiteServer({
      backend: `http://127.0.0.1:${backend.address().port}`,
      appAccess: 'fixture-app-key',
      user: 'service@example.com',
      userPass: 'fixture-password',
      production: false,
    })
    website.listen(0, '127.0.0.1')
    await once(website, 'listening')
    const response = await fetch(`http://127.0.0.1:${website.address().port}/api/schools`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ schools: ['Fixture University'] })
    expect(calls).toEqual(['/LogIn', '/Admin', '/Schools'])
    expect(deadline).toHaveBeenCalledWith(180000)
  } finally {
    for (const server of [website, backend]) {
      if (!server) continue
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
  }
}, 25000)
