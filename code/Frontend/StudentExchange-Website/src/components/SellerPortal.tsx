import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AccountState } from '../hooks/useAccount'
import { AccountApiError } from '../api/accounts'
import { marketplace, money, errorMessage } from '../api/marketplace'
import type { Catalog, Listing } from '../api/marketplace'
import { ListingArt } from './Marketplace'

export default function SellerPortal({
  account,
  onLogin,
}: {
  account: AccountState
  onLogin: () => void
}) {
  if (account.restoring)
    return (
      <section className="seller-portal">
        <p role="status">Restoring your account…</p>
      </section>
    )
  if (!account.profile)
    return (
      <section className="seller-portal">
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>Make room for what’s next.</h1>
        <p>
          Give your books and campus essentials another semester. Log in to
          create listings and manage your inventory.
        </p>
        <button className="button-primary" onClick={onLogin}>
          Log in to start selling
        </button>
      </section>
    )
  return <Inventory key={account.profile.email} account={account} />
}

function Inventory({ account }: { account: AccountState }) {
  const [rows, setRows] = useState<Listing[]>([])
  const [catalog, setCatalog] = useState<Catalog>({
    categories: [],
    conditions: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [create, setCreate] = useState(false)
  const [deleting, setDeleting] = useState<Listing | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  function handleError(e: unknown) {
    setError(errorMessage(e))
    if (e instanceof AccountApiError && e.status === 401) account.expire()
  }
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([
      marketplace.inventory(controller.signal),
      marketplace.catalog(controller.signal),
    ])
      .then(([result, values]) => {
        if (!controller.signal.aborted) {
          setRows(result.listings)
          setCatalog(values)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) handleError(e)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [revision])
  const visible = rows.filter(
    (row) =>
      (!status || row.status === status) &&
      `${row.title} ${row.isbn}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  )
  const pages = Math.max(1, Math.ceil(visible.length / 10))
  const current = Math.min(page, pages)
  return (
    <section className="seller-portal">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SELLER PORTAL</p>
          <h1>Your finds. Their next chapter.</h1>
          <p>
            Welcome, {account.profile?.first_name}. Manage the items you’re
            passing forward.
          </p>
        </div>
        <button
          className="button-primary"
          onClick={() => setCreate(true)}
          disabled={loading || !catalog.categories.length}
        >
          ＋ Create listing
        </button>
      </div>
      <div className="seller-stats">
        <div>
          <strong>{rows.length}</strong>
          <span>Total listings</span>
        </div>
        <div>
          <strong>
            {rows.filter((x) => x.status.toLowerCase() === 'active').length}
          </strong>
          <span>Active listings</span>
        </div>
        <div>
          <strong>
            {money(
              rows
                .filter((x) => x.status.toLowerCase() === 'active')
                .reduce((sum, x) => sum + x.price, 0),
            )}
          </strong>
          <span>Active asking prices</span>
        </div>
      </div>
      {notice && (
        <p className="admin-alert" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      )}
      <div className="market-toolbar">
        <label>
          Search your inventory
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Title or ISBN"
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All statuses</option>
            {[...new Set(rows.map((x) => x.status).filter(Boolean))].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </label>
        <button
          className="admin-button"
          onClick={() => setRevision((x) => x + 1)}
          disabled={loading}
        >
          Refresh inventory
        </button>
      </div>
      {loading ? (
        <p role="status">Loading your inventory…</p>
      ) : (
        !error &&
        (visible.length ? (
          <>
            <ul className="seller-inventory" aria-label="Your listings">
              {visible.slice((current - 1) * 10, current * 10).map((row) => (
                <li key={row.id}>
                  <ListingArt listing={row} />
                  <div>
                    <span className="admin-pill">
                      {row.status || 'Status unavailable'}
                    </span>
                    <h2>{row.title}</h2>
                    <p>
                      {row.category} · {row.condition}
                    </p>
                    <strong>{money(row.price)}</strong>
                    {row.isbn && <p>ISBN {row.isbn}</p>}
                  </div>
                  <button
                    className="admin-button destructive"
                    onClick={() => {
                      setError('')
                      setDeleting(row)
                    }}
                  >
                    Delete {row.title}
                  </button>
                </li>
              ))}
            </ul>
            <div className="admin-pagination">
              <span>
                Page {current} of {pages}
              </span>
              <div>
                <button
                  className="admin-button"
                  disabled={current === 1}
                  onClick={() => setPage(current - 1)}
                >
                  Previous
                </button>
                <button
                  className="admin-button"
                  disabled={current === pages}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>
              {rows.length
                ? 'No matching items'
                : 'Your next listing starts here.'}
            </h2>
            <p>
              {rows.length
                ? 'Try another title or status.'
                : 'Add a clear photo, an honest description, and your asking price.'}
            </p>
            <button
              className="admin-button"
              onClick={() => {
                if (rows.length) {
                  setQuery('')
                  setStatus('')
                } else setCreate(true)
              }}
            >
              {rows.length ? 'Clear filters' : 'Create your first listing'}
            </button>
          </div>
        ))
      )}
      <p className="market-hint">
        Buyers contact you by your account email. Agree on pickup and payment
        directly. Asking prices are not sales or earnings.
      </p>
      {create && (
        <ListingForm
          catalog={catalog}
          onClose={() => setCreate(false)}
          onCreated={(message) => {
            setCreate(false)
            setNotice(message)
            setRevision((x) => x + 1)
          }}
          onExpired={account.expire}
        />
      )}
      {deleting && (
        <PortalDialog
          title="Delete this listing?"
          busy={busy}
          onClose={() => {
            setDeleting(null)
            setError('')
          }}
        >
          <p>
            Remove “{deleting.title}” permanently? You can create a new listing
            later.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="admin-dialog-actions">
            <button
              className="admin-button"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="admin-button destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  const result = await marketplace.remove(deleting.id)
                  setDeleting(null)
                  setNotice(result.message)
                  setRevision((x) => x + 1)
                } catch (e) {
                  handleError(e)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Deleting…' : 'Delete listing'}
            </button>
          </div>
        </PortalDialog>
      )}
    </section>
  )
}

export function PortalDialog({
  title,
  busy = false,
  onClose,
  children,
}: {
  title: string
  busy?: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="admin-dialog-heading">
        <h2>{title}</h2>
        <button
          className="admin-icon-button"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={busy}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}

function ListingForm({
  catalog,
  onClose,
  onCreated,
  onExpired,
}: {
  catalog: Catalog
  onClose: () => void
  onCreated: (message: string) => void
  onExpired: () => void
}) {
  const [category, setCategory] = useState(catalog.categories[0] || '')
  const [image, setImage] = useState<string[]>([])
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState('')
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy || reading || imageError) return
    const data = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      const result = await marketplace.create({
        title: String(data.get('title')).trim(),
        description: String(data.get('description')).trim(),
        price: Number(data.get('price')),
        category,
        condition: String(data.get('condition')),
        ...(category === 'Textbooks' && data.get('isbn')
          ? { isbn: String(data.get('isbn')) }
          : {}),
        ...(image.length ? { imageBase64: image } : {}),
      })
      onCreated(result.message)
    } catch (e) {
      setError(errorMessage(e))
      if (e instanceof AccountApiError && e.status === 401) onExpired()
    } finally {
      setBusy(false)
    }
  }
  return (
    <PortalDialog title="Create a listing" busy={busy} onClose={onClose}>
      <form
        className="account-form listing-form"
        onSubmit={(e) => void submit(e)}
      >
        <fieldset disabled={busy}>
          <legend className="sr-only">Listing details</legend>
          <label>
            Title
            <input
              name="title"
              required
              maxLength={200}
              placeholder="What are you passing forward?"
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              maxLength={2000}
              rows={4}
              placeholder="Describe the item, wear, and pickup preferences."
            />
          </label>
          <div className="listing-form-row">
            <label>
              Price ($)
              <input
                name="price"
                type="number"
                required
                min="0"
                max="99999999.99"
                step="0.01"
                placeholder="0.00"
              />
            </label>
            <label>
              Condition
              <select
                aria-label="Condition"
                name="condition"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose condition
                </option>
                {catalog.conditions.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Category
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {catalog.categories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {category === 'Textbooks' && (
            <label>
              ISBN (optional)
              <input
                name="isbn"
                maxLength={100}
                placeholder="ISBN-10 or ISBN-13; hyphens accepted"
              />
            </label>
          )}
          <label>
            Photo (optional)
            <input
              type="file"
              multiple
              aria-label="Photo (optional)"
              accept="image/png,image/jpeg,image/webp"
              disabled={reading}
              onChange={async (e) => {
                setImage([])
                setImageError('')
                const files = Array.from(e.target.files || [])
                if (files.length > 8) {
                  setImageError('Choose no more than 8 photos.')
                  return
                }
                if (
                  files.some(
                    (file) =>
                      file.size > 2 * 1024 * 1024 ||
                      !['image/png', 'image/jpeg', 'image/webp'].includes(
                        file.type,
                      ),
                  )
                ) {
                  setImageError(
                    'Choose a PNG, JPEG, or WebP no larger than 2 MB.',
                  )
                  return
                }
                setReading(true)
                try {
                  const values = await Promise.all(
                    files.map(
                      (file) =>
                        new Promise<string>((resolve, reject) => {
                          const r = new FileReader()
                          r.onload = () => resolve(String(r.result))
                          r.onerror = () =>
                            reject(new Error('Unable to read photo.'))
                          r.readAsDataURL(file)
                        }),
                    ),
                  )
                  setImage(values)
                } catch {
                  setImageError('Unable to read the images. Choose them again.')
                } finally {
                  setReading(false)
                }
              }}
            />
            <small>Up to 8 photos · PNG, JPEG, or WebP · 2 MB each</small>
          </label>
          {image.length > 0 && (
            <div className="listing-preview">
              {image.map((src, i) => (
                <img key={i} src={src} alt={`Listing photo preview ${i + 1}`} />
              ))}
              <button
                type="button"
                className="admin-button"
                onClick={() => setImage([])}
              >
                Remove photos
              </button>
            </div>
          )}
          {(error || imageError) && (
            <p className="admin-alert error" role="alert">
              {error || imageError}
            </p>
          )}
          <div className="admin-dialog-actions">
            <button type="button" className="admin-button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="admin-button primary"
              disabled={reading || Boolean(imageError)}
            >
              {busy
                ? 'Publishing…'
                : reading
                  ? 'Reading photo…'
                  : 'Publish listing'}
            </button>
          </div>
        </fieldset>
      </form>
    </PortalDialog>
  )
}
