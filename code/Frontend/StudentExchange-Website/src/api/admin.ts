import { request as accountRequest } from './accounts'
import type { Profile, ProfileUpdate } from './accounts'

// Admin calls include a fresh membership check; updates also read the saved profile.
// Allow those bounded upstream deadlines to finish before the browser gives up.
function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
) {
  return accountRequest<T>(
    path,
    method,
    body,
    signal,
    method === 'PATCH' || path === 'admin/sessions' ? 50000 : 35000,
  )
}

export interface AdminAccess {
  is_admin: boolean
  level: number | null
  permissions: {
    users: boolean
    profiles: boolean
    deleteUsers: boolean
    blocked: boolean
    endSessions: boolean
  }
}
export interface AdminUser {
  email: string
  name: string
  school: string
  datetime: string
}
export interface AttemptRecord {
  email: string
  name: string
  expiry: string
  count: number
  ip?: string
}
export interface Attempts {
  blockedUsers: AttemptRecord[]
  blockedIPs: AttemptRecord[]
}
export const admin = {
  access: (signal?: AbortSignal) =>
    request<AdminAccess>('admin', 'GET', undefined, signal),
  users: (signal?: AbortSignal) =>
    request<{ users: AdminUser[] }>('admin/users', 'GET', undefined, signal),
  profile: (email: string, signal?: AbortSignal) =>
    request<{ profile: Profile }>(
      `admin/profile?email=${encodeURIComponent(email)}`,
      'GET',
      undefined,
      signal,
    ),
  update: (email: string, fields: ProfileUpdate) =>
    request<{ profile: Profile | null; message: string }>(
      `admin/profile?email=${encodeURIComponent(email)}`,
      'PATCH',
      fields,
    ),
  deleteUser: (to_user: string) =>
    request<{ message: string }>('admin/users', 'DELETE', { to_user }),
  endSessions: (email: string) =>
    request<{ message: string }>('admin/sessions', 'DELETE', { email }),
  blocked: (signal?: AbortSignal) =>
    request<Attempts>('admin/blocked', 'GET', undefined, signal),
  clearAttempts: (selector: { email: string } | { ip_addr: string }) =>
    request<{ message: string }>('admin/blocked', 'DELETE', selector),
}
