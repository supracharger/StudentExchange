import { BACKEND_ORIGIN, validateBackend } from './backend-policy.mjs'
export function loadDeploymentConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') throw new Error('NODE_ENV must be production for the deployment entry point.')
  if (env.NODE_TLS_REJECT_UNAUTHORIZED !== undefined && env.NODE_TLS_REJECT_UNAUTHORIZED !== '1') throw new Error('TLS certificate verification must remain enabled.')
  const appAccess = env.SE_APP_ACCESS
  if (!appAccess?.trim() || appAccess === 'mock-app-only' || appAccess === 'replace-in-secret-manager')
    throw new Error('SE_APP_ACCESS must be supplied from server runtime secret storage.')
  const backend = env.SE_BACKEND_URL
  if (!backend) throw new Error('SE_BACKEND_URL is required.')
  const flag = env.SE_ENABLE_BACKEND_TRAFFIC ?? 'false'
  if (!['true','false'].includes(flag)) throw new Error('SE_ENABLE_BACKEND_TRAFFIC must be true or false.')
  const trafficPolicy = Object.freeze({ mode:'deployed', enabled:flag === 'true' })
  validateBackend(backend, trafficPolicy)
  let origin
  try { origin = new URL(env.SE_PUBLIC_ORIGIN) } catch { throw new Error('SE_PUBLIC_ORIGIN must be the public HTTPS adapter origin.') }
  if (origin.protocol !== 'https:' || origin.port || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' || origin.origin === BACKEND_ORIGIN || origin.hostname === 'localhost' || origin.hostname === '127.0.0.1')
    throw new Error('SE_PUBLIC_ORIGIN must be a separate public HTTPS adapter origin.')
  if (env.SE_SESSION_STORE && env.SE_SESSION_STORE !== 'memory') throw new Error('Only the single-instance memory session store is implemented.')
  if (env.WEB_CONCURRENCY && env.WEB_CONCURRENCY !== '1') throw new Error('Run one Node process; a shared session store is required for multiple workers.')
  function number(key, fallback, min, max) {
    const value = env[key] ?? String(fallback)
    if (!/^\d+$/.test(value) || Number(value)<min || Number(value)>max) throw new Error(`${key} is outside its allowed range.`)
    return Number(value)
  }
  return {
    backend, appAccess, publicOrigin:origin.origin, trafficPolicy, production:true, apiOnly:true,
    port:number('PORT',8080,1,65535),
    timeoutMs:number('SE_UPSTREAM_TIMEOUT_MS',180000,1000,180000),
    limits: {
      requestsPerMinute:number('SE_REQUESTS_PER_MINUTE',300,1,10000),
      authPerMinute:number('SE_AUTH_REQUESTS_PER_MINUTE',20,1,1000),
      concurrent:number('SE_MAX_CONCURRENT_REQUESTS',4,1,16),
    },
  }
}
