import { request } from './accounts'
import type { Profile, ProfileUpdate } from './accounts'

export interface AdminAccess {
  is_admin: boolean
  level: number | null
  permissions: {
    manageAdmins: boolean
    lockAdmins: boolean
    viewAdminLevels: boolean
    schools: boolean
    users: boolean
    profiles: boolean
    deleteUsers: boolean
    blocked: boolean
    endSessions: boolean
  }
}
export interface AdminSchool {
  name: string
  short_name: string
}
export interface AdminUser {
  isAdmin: boolean
  locked: boolean
  level?: number | null
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
}
export interface IPAttemptRecord {
  ip: string
  expiry: string
  count: number
  users: { name: string; email: string }[]
}
export interface Attempts {
  blockedUsers: AttemptRecord[]
  blockedIPs: IPAttemptRecord[]
}
export const admin = {
  assign: (method: 'POST' | 'PATCH' | 'DELETE', fields: { to_user: string; level?: number; locked?: number }) =>
    request<{ message: string }>('admin', method, fields),
  schools: (signal?: AbortSignal) =>
    request<{ schools: AdminSchool[] }>('admin/schools', 'GET', undefined, signal),
  addSchool: (school: AdminSchool) =>
    request<{ message: string }>('admin/schools', 'POST', school),
  deleteSchool: (selector: { name?: string; short_name?: string }) =>
    request<{ message: string }>('admin/schools', 'DELETE', selector),
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
