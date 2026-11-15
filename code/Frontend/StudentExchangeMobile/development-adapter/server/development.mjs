import { once } from 'node:events'
import { createWebsiteServer } from './app.mjs'
import { createMockBackend } from './mock-backend.mjs'

// This launcher remains mock-only even when a local environment credential is supplied.
const appAccess = process.env.SE_APP_ACCESS?.trim() || 'mock-app-only'
const mock = createMockBackend({ appAccess })
mock.listen(0, '127.0.0.1')
await once(mock, 'listening')
const adapter = createWebsiteServer({
  backend: `http://127.0.0.1:${mock.address().port}/`,
  appAccess,
  production: false,
})
adapter.listen(3100, '127.0.0.1')
await once(adapter, 'listening')
console.log('Mock-only development API: http://127.0.0.1:3100/api/listings')
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  adapter.closeAllConnections(); mock.closeAllConnections()
  adapter.close(); mock.close()
})
