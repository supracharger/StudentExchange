import { isIP } from 'node:net'

function normalize(address) {
  if (typeof address !== 'string') throw new Error('Client IP is unavailable.')
  let ip = address.trim()
  // Node exposes IPv4 peers as IPv4-mapped IPv6 on some platforms.
  if (/^::ffff:/i.test(ip) && isIP(ip.slice(7)) === 4) ip = ip.slice(7)
  if (!isIP(ip) || ip.includes('%')) throw new Error('Client IP is invalid.')
  return ip
}

/**
 * Local/direct requests use the socket peer and ignore all forwarding headers.
 * Render's public edge uses Cloudflare. Its CF-Connecting-IP is a single visitor
 * address, independent of the length and contents of X-Forwarded-For.
 * Trust it only when the server is explicitly running behind that managed edge;
 * never derive trust from a browser header. Missing/invalid edge data fails closed.
 */
export function clientIp(request, { renderProxy = false } = {}) {
  return normalize(
    renderProxy
      ? request.headers['cf-connecting-ip']
      : request.socket.remoteAddress,
  )
}
