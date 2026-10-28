import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { accounts, request, AccountApiError } from './accounts'
import { admin } from './admin'

beforeEach(() => {
  vi.useFakeTimers()
  // Native AbortSignal.timeout uses an internal clock; make deadlines deterministic.
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms)
    return controller.signal
  })
})
afterEach(() => vi.useRealTimers())

function delayedFetch(delay: number) {
  const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => resolve(new Response(JSON.stringify({ schools: [] }))), delay)
    init.signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(init.signal?.reason)
    }, { once: true })
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

it.each([
  ['school lookup', () => accounts.schools()],
  ['login', () => accounts.login('student@example.com', 'fixture-password')],
  ['administrator lookup', () => admin.users()],
  ['administrator update', () => admin.update('student@example.com', { first_name: 'Sam' })],
] as const)('allows a two-minute cold start for %s without replaying the request', async (_label, call) => {
  const fetchMock = delayedFetch(125000)
  const result = call()
  await vi.advanceTimersByTimeAsync(125000)
  await expect(result).resolves.toEqual({ schools: [] })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('still bounds a stalled request without retrying a write', async () => {
  const fetchMock = delayedFetch(600000)
  const result = accounts.login('student@example.com', 'fixture-password')
  const assertion = expect(result).rejects.toBeInstanceOf(AccountApiError)
  await vi.advanceTimersByTimeAsync(300000)
  await assertion
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('preserves immediate cancellation by the caller', async () => {
  const fetchMock = delayedFetch(125000)
  const controller = new AbortController()
  const result = request('schools', 'GET', undefined, controller.signal)
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await assertion
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
