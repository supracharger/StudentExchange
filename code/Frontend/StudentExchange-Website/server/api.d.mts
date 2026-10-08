import type { RequestListener } from 'node:http'

export function createApiHandler(config?: {
  backend?: string
  appAccess?: string
  adminToken?: string
  renderProxy?: boolean
  production?: boolean
  timeoutMs?: number
}): RequestListener
