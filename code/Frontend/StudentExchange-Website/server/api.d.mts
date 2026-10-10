import type { RequestListener } from 'node:http'

export function backendUrl(backend?: string): URL | undefined
export function upstream(
  base: URL,
  route: string,
  method: string,
  body?: Record<string, unknown>,
  timeoutMs?: number,
): Promise<unknown>

export function createApiHandler(config?: {
  backend?: string
  appAccess?: string
  adminToken?: string
  renderProxy?: boolean
  production?: boolean
  timeoutMs?: number
}): RequestListener
