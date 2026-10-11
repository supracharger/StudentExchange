// @vitest-environment node
import { expect, it } from 'vitest'
import { adminUsers } from './admin.mjs'
const data = { body: {
  email: ['student@example.com', 'admin@example.com'], name: ['Student', 'Admin'],
  school: ['C', 'C'], datetime: ['2026-10-11T10:00:00', '2026-10-11T10:00:00'],
  isAdmin: [0, 1], locked: [0, 1], level: [-1, 20], password: ['secret', 'secret'],
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
it('accepts the deployed level-30 directory shape, including level zero and the non-admin sentinel', () => {
  const response = { body: {
    email: ['robot@example.com', 'chat@example.com', 'owner@example.com', 'student@example.com'],
    name: ['Website, Robot', 'Gpt, Chat', 'Owner, Admin', 'Student, Bob'],
    school: ['Campus', 'Campus', 'Campus', 'Another Campus'],
    datetime: Array(4).fill('2026-10-10T07:54:31'),
    isAdmin: [1, 1, 1, 0], locked: [1, 0, 1, 0], level: [0, 20, 70, -1],
  } }
  const rows = adminUsers(response, true)
  expect(rows.map(row => row.level)).toEqual([0, 20, 70, null])
  expect(rows.map(row => row.isAdmin)).toEqual([true, true, true, false])
  expect(rows.map(row => row.locked)).toEqual([true, false, true, false])
  expect(adminUsers(response).every(row => !Object.hasOwn(row, 'level'))).toBe(true)
})
it('also accepts null for a non-admin level', () => {
  expect(adminUsers({ body: { ...data.body, level: [null, 20] } }, true)[0].level).toBeNull()
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
