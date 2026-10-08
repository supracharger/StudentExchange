// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clientIp } from './client-ip.mjs'

function request(peer, headers = {}) {
  return { socket: { remoteAddress: peer }, headers }
}

describe('trusted client IP', () => {
  it('ignores spoofed forwarding headers on direct and local requests', () => {
    expect(
      clientIp(
        request('::ffff:127.0.0.1', {
          'cf-connecting-ip': '203.0.113.9',
          'x-forwarded-for': '203.0.113.8',
          'x-real-ip': '203.0.113.7',
        }),
      ),
    ).toBe('127.0.0.1')
  })
  it('uses the Render/Cloudflare visitor header rather than a spoofed XFF chain or socket proxy', () => {
    expect(
      clientIp(
        request('10.0.0.2', {
          'cf-connecting-ip': '198.51.100.9',
          'x-forwarded-for': '203.0.113.8, 198.51.100.9, 192.0.2.5',
        }),
        { renderProxy: true },
      ),
    ).toBe('198.51.100.9')
  })
  it('preserves real IPv6 visitor addresses', () => {
    expect(
      clientIp(request('10.0.0.2', { 'cf-connecting-ip': '2001:db8::25' }), {
        renderProxy: true,
      }),
    ).toBe('2001:db8::25')
  })
  it.each([
    undefined,
    '',
    'unknown',
    '198.51.100.1, 203.0.113.1',
    '198.51.100.1:5000',
    'http://198.51.100.1',
    ['198.51.100.1'],
    'fe80::1%eth0',
  ])('rejects missing or malformed Render visitor headers: %j', (value) => {
    expect(() =>
      clientIp(request('10.0.0.2', { 'cf-connecting-ip': value }), {
        renderProxy: true,
      }),
    ).toThrow()
  })
})
