import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import { createApiHandler } from './server/api.mjs'

export default defineConfig(({ mode }) => {
  // Read server settings without exposing them through Vite's public VITE_* prefix.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const accountApi = () =>
    createApiHandler({
      backend: env.backend,
      appAccess: env.app_access,
      adminToken: env.admin_token,
    })
  return {
    plugins: [
      react(),
      {
        name: 'student-exchange-account-api',
        configureServer(server) {
          const handler = accountApi()
          server.middlewares.use((request, response, next) => {
            if (request.url === '/api' || request.url?.startsWith('/api/'))
              return handler(request, response)
            next()
          })
        },
        configurePreviewServer(server) {
          const handler = accountApi()
          server.middlewares.use((request, response, next) => {
            if (request.url === '/api' || request.url?.startsWith('/api/'))
              return handler(request, response)
            next()
          })
        },
      },
    ],
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      clearMocks: true,
    },
  }
})
