import ListingEditor from './ListingEditor'
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

function SellerPageLink({ username }: { username: string }) {
  const url = `${window.location.origin}/sellers/${encodeURIComponent(username)}`
  const [copying, setCopying] = useState(false)
  const [feedback, setFeedback] = useState('')
  async function copy() {
    setCopying(true)
    setFeedback('')
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(url)
      setFeedback('Link copied!')
    } catch {
      setFeedback(
        'Unable to copy automatically. Select and copy the link above.',
      )
    } finally {
      setCopying(false)
    }
  }
  return (
    <aside className="seller-share" aria-label="Your public seller page">
      <strong>Your website is:</strong>
      <div>
        <a href={url}>{url}</a>
        <button
          type="button"
          className="admin-button"
          aria-label="Copy seller page link"
          disabled={copying}
          onClick={() => void copy()}
        >
          {copying ? 'Copying…' : 'Copy link'}
        </button>
      </div>
      {feedback && <p role="status">{feedback}</p>}
    </aside>
  )
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
  const [editing, setEditing] = useState<Listing | null>(null)
  const [deactivating, setDeactivating] = useState<Listing | null>(null)
  const [busy, setBusy] = useState(false)
  const [sellingId, setSellingId] = useState<number | null>(null)
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
  async function markSold(row: Listing) {
    if (busy) return
    setBusy(true)
    setSellingId(row.id)
    setError('')
    setNotice('')
    try {
      await marketplace.update({ id: row.id, status: 'Sold' })
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, status: 'Sold' } : item,
        ),
      )
      setNotice(`“${row.title}” is now Sold.`)
    } catch (reason) {
      handleError(reason)
    } finally {
      setBusy(false)
      setSellingId(null)
    }
  }
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
      {account.profile?.user ? (
        <SellerPageLink
          key={account.profile.user}
          username={account.profile.user}
        />
      ) : (
        <p className="market-hint">
          Your public website link will appear here once your account has a
          username. Check My account to update your username.
        </p>
      )}
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
        (!error || rows.length > 0) &&
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
                    {row.hit != null && <p>{row.hit} views</p>}
                    {row.days != null && (
                      <p>
                        {row.days < 0
                          ? 'Renewal overdue'
                          : `${row.days} days remaining`}
                      </p>
                    )}
                    {row.status === 'Blocked' && (
                      <p>
                        Blocked by an administrator. Contact support to make
                        changes.
                      </p>
                    )}
                    {row.isbn && <p>ISBN {row.isbn}</p>}
                  </div>
                  <div className="inventory-actions">
                    <button
                      type="button"
                      className="admin-button primary"
                      aria-label={`Mark ${row.title} as Sold`}
                      disabled={
                        busy ||
                        row.status === 'Sold' ||
                        row.status === 'Blocked'
                      }
                      onClick={() => void markSold(row)}
                    >
                      {sellingId === row.id
                        ? 'Marking Sold…'
                        : row.status === 'Sold'
                          ? 'Sold'
                          : 'Mark as Sold'}
                    </button>
                    <button
                      className="admin-button"
                      disabled={busy || row.status === 'Blocked'}
                      aria-label={`Edit ${row.title}`}
                      onClick={() => setEditing(row)}
                    >
                      Edit listing
                    </button>
                    <button
                      aria-label={`Set Inactive: ${row.title}`}
                      className="admin-button"
                      disabled={
                        busy ||
                        row.status === 'Inactive' ||
                        row.status === 'Blocked'
                      }
                      onClick={() => {
                        setError('')
                        setDeactivating(row)
                      }}
                    >
                      Set Inactive
                    </button>
                  </div>
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
      {editing && (
        <ListingEditor
          listing={editing}
          onClose={() => setEditing(null)}
          onError={handleError}
          onSaved={(message) => {
            setEditing(null)
            setNotice(message)
            setRevision((x) => x + 1)
          }}
        />
      )}
      {deactivating && (
        <PortalDialog
          title="Set listing to Inactive?"
          busy={busy}
          onClose={() => {
            setDeactivating(null)
            setError('')
          }}
        >
          <p>
            Hide “{deactivating.title}” from browse? Your listing and photos
            will stay in your inventory.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="admin-dialog-actions">
            <button
              className="admin-button"
              disabled={busy}
              onClick={() => setDeactivating(null)}
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
                  const result = await marketplace.deactivate(deactivating.id)
                  setDeactivating(null)
                  setNotice(result.message)
                  setRevision((x) => x + 1)
                } catch (e) {
                  handleError(e)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Updating…' : 'Set Inactive'}
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
            Photos (optional)
            <input
              type="file"
              multiple
              aria-label="Photo (optional)"
              accept="image/png,image/jpeg,image/webp"
              disabled={reading || image.length >= 8}
              onChange={async (e) => {
                const files = Array.from(e.target.files || [])
                e.target.value = ''
                if (!files.length) return
                setImageError('')
                if (image.length + files.length > 8) {
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
                  setImage((current) => [...current, ...values])
                } catch {
                  setImageError('Unable to read the images. Choose them again.')
                } finally {
                  setReading(false)
                }
              }}
            />
            <small>
              Add photos together or one at a time. Up to 8 · PNG, JPEG, or WebP
              · 2 MB each. The first photo is your cover.
            </small>
            <span role="status">{image.length} of 8 photos added</span>
          </label>
          {image.length > 0 && (
            <ol
              className="upload-photo-grid"
              aria-label="Selected listing photos"
            >
              {image.map((src, i) => (
                <li key={`${i}-${src.slice(-24)}`}>
                  <img src={src} alt={`Listing photo preview ${i + 1}`} />
                  <span>{i === 0 ? 'Cover photo' : `Photo ${i + 1}`}</span>
                  <div>
                    <button
                      type="button"
                      className="admin-button"
                      disabled={reading || i === 0}
                      aria-label={`Make photo ${i + 1} the cover`}
                      onClick={() =>
                        setImage((current) => [
                          current[i],
                          ...current.filter((_, index) => index !== i),
                        ])
                      }
                    >
                      Make cover
                    </button>
                    <button
                      type="button"
                      className="admin-button"
                      disabled={reading}
                      aria-label={`Remove photo ${i + 1}`}
                      onClick={() => {
                        setImage((current) =>
                          current.filter((_, index) => index !== i),
                        )
                        setImageError('')
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
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
