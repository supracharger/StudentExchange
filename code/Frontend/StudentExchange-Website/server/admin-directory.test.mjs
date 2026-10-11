// @vitest-environment node
import { expect, it } from 'vitest'
import { adminUsers } from './admin.mjs'
const data = { body: {
  email: ['student@example.com', 'admin@example.com'], name: ['Student', 'Admin'],
  school: ['C', 'C'], datetime: ['2026-10-11T10:00:00', '2026-10-11T10:00:00'],
  isAdmin: [0, 1], locked: [0, 1], level: [null, 20], password: ['secret', 'secret'],
} }
it('normalizes flags and keeps privileged levels out of lower-level responses', () => {
  const rows = adminUsers(data)
  expect(rows[0].isAdmin).toBe(false)
  expect(rows[1].isAdmin).toBe(true)
  expect(rows[1].locked).toBe(true)
  for (const row of rows) {
    expect(row).not.toHaveProperty('level')
    expect(row).not.toHaveProperty('password')
  }
  expect(adminUsers(data, true).map(row => row.level)).toEqual([null, 20])
})
it.each([
  { isAdmin: [0] }, { locked: [0, 'true'] }, { isAdmin: [0, 2] },
  { level: [null, '20'] }, { level: [null, -1] }, { level: [3, 20] },
])('rejects malformed flags or levels: %j', columns => {
  expect(() => adminUsers({ body: { ...data.body, ...columns } }, true)).toThrow('unexpected response')
})
it('accepts a completely empty directory', () => {
  expect(adminUsers({ body: {} }, true)).toEqual([])
})
