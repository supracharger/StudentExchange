import { useState } from 'react'
import type { AdminAccess, AdminUser } from '../api/admin'

type Method = 'POST' | 'PATCH' | 'DELETE'
type Fields = { to_user: string; level?: number; locked?: number }

export default function AdminAccessPanel({ access, target, onSubmit }: {
  access: AdminAccess
  target: AdminUser | null
  onSubmit: (method: Method, fields: Fields) => void
}) {
  const [email, setEmail] = useState(target?.email || '')
  const [method, setMethod] = useState<Method>(target?.isAdmin ? 'PATCH' : 'POST')
  const [level, setLevel] = useState(target?.level == null ? '' : String(target.level))
  const [locked, setLocked] = useState('')
  const rank = Number(level)
  const valid = email.trim() && (method === 'DELETE' ||
    (level !== '' && Number.isInteger(rank) && rank >= 0 && rank < (access.level ?? 0)))
  return (
    <div className="admin-card admin-session-card">
      <h2>Administrator privileges</h2>
      <p>Assign a level below your own. The service checks target eligibility before applying a change.</p>
      <form onSubmit={event => {
        event.preventDefault()
        if (!valid) return
        const fields: Fields = { to_user: email }
        if (method !== 'DELETE') {
          fields.level = rank
          if (access.permissions.lockAdmins && locked !== '') fields.locked = Number(locked)
        }
        onSubmit(method, fields)
      }}>
        <label>Target account email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="off" /></label>
        <label>Operation<select value={method} onChange={event => setMethod(event.target.value as Method)}>
          <option value="POST">Grant admin access</option>
          <option value="PATCH">Update admin access</option>
          <option value="DELETE">Remove admin access</option>
        </select></label>
        {method !== 'DELETE' && <>
          <label>Admin level<input type="number" min={0} max={(access.level ?? 0) - 1} step={1} required value={level} onChange={event => setLevel(event.target.value)} /></label>
          {access.permissions.lockAdmins && <label>Locked status<select value={locked} onChange={event => setLocked(event.target.value)}>
            <option value="">Keep existing / default</option>
            <option value="1">Locked</option>
            <option value="0">Unlocked</option>
          </select></label>}
        </>}
        <button className="admin-button primary" disabled={!valid}>Review change…</button>
      </form>
    </div>
  )
}
