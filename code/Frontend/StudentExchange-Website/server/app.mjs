import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApiHandler } from './api.mjs'

const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

/** Serve the built website and its API from one origin in production. */
export function createWebsiteServer({
  backend,
  appAccess,
  production = true,
  timeoutMs,
  dist = DIST,
} = {}) {
  const api = createApiHandler({ backend, appAccess, production, timeoutMs })
  const root = resolve(dist)
  return http.createServer(
    { requestTimeout: 30000, headersTimeout: 10000 },
    async (request, response) => {
      // Headers apply to both API and static responses, including error pages.
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      )
      let pathname
      try {
        pathname = decodeURIComponent(
          new URL(request.url, 'http://website.local').pathname,
        )
      } catch {
        response.writeHead(400)
        response.end('Invalid URL')
        return
      }
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        await api(request, response)
        return
      }
      if (pathname === '/healthz') {
        // Render uses this lightweight process health check; it does not claim upstream readiness.
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        })
        response.end(
          JSON.stringify({
            status: 'ok',
            accountsConfigured: Boolean(backend && appAccess),
          }),
        )
        return
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' })
        response.end()
        return
      }
      const candidate = resolve(
        root,
        `.${pathname === '/' ? '/index.html' : pathname}`,
      )
      if (!candidate.startsWith(`${root}${sep}`)) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }
      let file = candidate
      let contents
      try {
        contents = await readFile(file)
      } catch {
        // SPA fallback is only for extensionless page routes, never missing JS/CSS or API routes.
        if (extname(pathname)) {
          response.writeHead(404)
          response.end('Not found')
          return
        }
        file = resolve(root, 'index.html')
        try {
          contents = await readFile(file)
        } catch {
          response.writeHead(503)
          response.end('Build the website before starting the server.')
          return
        }
      }
      response.writeHead(200, {
        'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': file.includes(`${sep}assets${sep}`)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      })
      response.end(request.method === 'HEAD' ? undefined : contents)
    },
  )
}
