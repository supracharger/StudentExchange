// @vitest-environment node
import { expect, it } from 'vitest'
import { attemptRecords } from './admin.mjs'

const record = {
  ip: '192.0.2.3', expiry: '2026-10-10T12:00:00', count: 4,
  users: [
    { name: 'Student, First', email: 'first@example.com', password: 'secret' },
    { name: 'Student, Second', email: 'second@example.com', access_token: 'secret' },
  ],
  password: 'secret',
}
it('preserves one IP row with all associated users and projects nested identities safely', () => {
  expect(attemptRecords({ blockedUsers: [], blockedIPs: [record] })).toEqual({
    blockedUsers: [], blockedIPs: [{
      ip: record.ip, expiry: record.expiry, count: 4,
      users: [
        { name: 'Student, First', email: 'first@example.com' },
        { name: 'Student, Second', email: 'second@example.com' },
      ],
    }],
  })
})
it('accepts empty IP associations and empty attempt lists', () => {
  expect(attemptRecords({ blockedUsers: [], blockedIPs: [] })).toEqual({ blockedUsers: [], blockedIPs: [] })
  expect(attemptRecords({ blockedUsers: [], blockedIPs: [{ ...record, users: [] }] }).blockedIPs[0].users).toEqual([])
})
it.each([undefined, null, {}, [null], [{ name: 'Sam' }], [{ name: 3, email: 'sam@example.com' }]])(
  'rejects malformed nested users: %j', users => {
    expect(() => attemptRecords({ blockedUsers: [], blockedIPs: [{ ...record, users }] })).toThrow('unexpected response')
  },
)
