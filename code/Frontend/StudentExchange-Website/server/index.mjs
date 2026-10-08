import { createWebsiteServer } from './app.mjs'

// These are server-only settings. Never prefix app_access with VITE_ or log its value.
const production = process.env.NODE_ENV === 'production'
const server = createWebsiteServer({
  backend: process.env.backend,
  appAccess: process.env.app_access,
  adminToken: process.env.admin_token,
  // Render supplies this server-side flag; local clients cannot turn header trust on.
  renderProxy: process.env.RENDER === 'true',
  production,
})
const port = Number(process.env.PORT || 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be a valid TCP port.')
server.listen(port, '0.0.0.0', () => {
  console.log(`Student Exchange server listening on port ${port}.`)
  if (
    !process.env.backend ||
    !process.env.app_access ||
    !process.env.admin_token
  )
    console.warn(
      'Account service is not configured. Set backend, app_access, and admin_token on the server.',
    )
})

// Allow the hosting platform to finish active requests when it replaces an instance.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10000).unref()
  })
}
