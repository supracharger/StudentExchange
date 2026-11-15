// Fixed backend identity; never derived from a client header, path or request body.
export const BACKEND_ORIGIN = 'https://studentexchangebck-fpdnfpcqe4bje2eh.westus-01.azurewebsites.net'
export const MOCK_POLICY = Object.freeze({ mode: 'mock', enabled: true })
export function policyError(message, status = 503) {
  const error = new Error(message); error.name = 'AdminContractError'; error.status = status; throw error
}
export function validateBackend(backend, policy = MOCK_POLICY) {
  if (!backend) return undefined
  let base
  try { base = new URL(backend) } catch { throw new Error('Invalid backend URL.') }
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/')
    throw new Error('Backend URL must be a root origin without credentials, query or fragment.')
  if (policy.mode === 'mock') {
    if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1') throw new Error('Development adapter requires an HTTP 127.0.0.1 mock backend.')
  } else if (policy.mode !== 'deployed' || base.origin !== BACKEND_ORIGIN) {
    throw new Error('Deployed adapter requires the fixed allowlisted HTTPS backend origin.')
  }
  return base
}
export function destinationFor(base, route, policy = MOCK_POLICY) {
  validateBackend(base?.href, policy)
  if (!base) policyError('Backend is not configured.')
  if (policy.mode === 'deployed' && policy.enabled !== true)
    policyError('Backend traffic is disabled by deployment configuration.')
  const destination = new URL(route, base)
  if (destination.origin !== base.origin || destination.username || destination.password || destination.hash)
    policyError('Upstream destination is not allowed.')
  // Deployed transport is a mobile API, not the inherited website/admin proxy.
  if (policy.mode === 'deployed') {
    const path = destination.pathname
    if (!/^\/(Listing(?:\/[1-9][0-9]*)?|LogIn|Register|Category|Condition|Schools|api\/Message(?:\/(?:unread|[1-9][0-9]*))?|uploads\/[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp))$/.test(path))
      policyError('Upstream route is not allowed.')
    if (destination.search && (!/^\/api\/Message\/[1-9][0-9]*$/.test(path) || !/^\?after=(0|[1-9][0-9]*)$/.test(destination.search)))
      policyError('Upstream query is not allowed.')
  }
  return destination
}
