import type { RequestListener } from 'node:http'

export function createApiHandler(config?: {
  backend?: string
  appAccess?: string
  production?: boolean
  timeoutMs?: number
}): RequestListener
