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
it('preserves successful and failed user/IP rows together', () => {
  const user = { name: 'Student', email: 'student@example.com', expiry: record.expiry }
  const result = attemptRecords({
    blockedUsers: [{ ...user, count: -1 }, { ...user, count: 3 }],
    blockedIPs: [{ ...record, count: -1 }, record],
  })
  expect(result.blockedUsers.map(row => row.count)).toEqual([-1, 3])
  expect(result.blockedIPs.map(row => row.count)).toEqual([-1, 4])
  expect(result.blockedIPs[0].users).toHaveLength(2)
})
it.each([-2, -1.5, 0.5, '-1', null])('rejects invalid counts for both record types: %j', count => {
  expect(() => attemptRecords({ blockedUsers: [], blockedIPs: [{ ...record, count }] })).toThrow('unexpected response')
  expect(() => attemptRecords({ blockedUsers: [{ name: 'Student', email: 'student@example.com', expiry: record.expiry, count }], blockedIPs: [] })).toThrow('unexpected response')
})
it.each([undefined, null, {}, [null], [{ name: 'Sam' }], [{ name: 3, email: 'sam@example.com' }]])(
  'rejects malformed nested users: %j', users => {
    expect(() => attemptRecords({ blockedUsers: [], blockedIPs: [{ ...record, users }] })).toThrow('unexpected response')
  },
)
