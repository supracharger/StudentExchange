import { useEffect, useState } from 'react'
import { admin } from '../api/admin'
import type { AdminSchool } from '../api/admin'

export default function SchoolsPanel({
  onError,
  onAdded,
  onDelete,
}: {
  onError: (reason: unknown) => void
  onAdded: (message: string) => void
  onDelete: (school: AdminSchool) => void
}) {
  const [schools, setSchools] = useState<AdminSchool[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoaded(false)
    admin.schools(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setSchools(result.schools)
          setLoaded(true)
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) onError(reason)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [revision])

  return (
    <div className="admin-schools">
      <div className="admin-card admin-session-card">
        <h2>Add a school</h2>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (busy || !name.trim() || !shortName.trim()) return
            setBusy(true)
            try {
              const result = await admin.addSchool({ name, short_name: shortName })
              onAdded(result.message)
              setName('')
              setShortName('')
              setRevision((value) => value + 1)
            } catch (reason) {
              onError(reason)
            } finally {
              setBusy(false)
            }
          }}
        >
          <label>
            School name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Short name
            <input
              required
              value={shortName}
              onChange={(event) => setShortName(event.target.value)}
              disabled={busy}
            />
          </label>
          <button
            className="admin-button primary"
            disabled={busy || !name.trim() || !shortName.trim()}
          >
            {busy ? 'Adding school…' : 'Add school'}
          </button>
        </form>
      </div>
      <div className="admin-card">
        <h2>School directory</h2>
        {loading ? (
          <p role="status">Loading schools…</p>
        ) : !loaded ? (
          <button
            className="admin-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Retry school list
          </button>
        ) : schools.length === 0 ? (
          <p>No schools yet. Add the first school above.</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">School name</th>
                  <th scope="col">Short name</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school, index) => (
                  <tr key={`${school.name}-${school.short_name}-${index}`}>
                    <td>{school.name}</td>
                    <td>{school.short_name}</td>
                    <td>
                      <button
                        className="admin-button danger"
                        aria-label={`Delete school ${school.name}`}
                        disabled={busy}
                        onClick={() => onDelete(school)}
                      >
                        Delete…
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
