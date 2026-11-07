import { useEffect, useState } from 'react'
import { marketplace, errorMessage } from '../api/marketplace'
import type { Catalog, Listing, ListingUpdate } from '../api/marketplace'
import { PortalDialog } from './SellerPortal'

export default function ListingEditor({
  listing,
  email,
  onClose,
  onSaved,
  onError,
}: {
  listing: Listing
  email?: string
  onClose: () => void
  onSaved: (message: string) => void
  onError: (error: unknown) => void
}) {
  const [detail, setDetail] = useState<Listing | null>(null)
  const [catalog, setCatalog] = useState<Catalog>({
    categories: [],
    conditions: [],
  })
  const [fields, setFields] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: '',
    isbn: '',
    status: '',
  })
  const [images, setImages] = useState<{ src: string; original?: number }[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    setDetail(null)
    Promise.all([
      marketplace.detail(listing.id, controller.signal),
      marketplace.catalog(controller.signal),
    ])
      .then(([result, values]) => {
        if (controller.signal.aborted) return
        const row = result.listing
        setFields({
          title: row.title,
          description: row.description,
          price: String(row.price),
          category: row.category,
          condition: row.condition,
          isbn: row.isbn,
          status: row.status,
        })
        setImages(
          (row.images_url || []).map((src, original) => ({ src, original })),
        )
        setCatalog(values)
        setDetail(row)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e))
      })
    return () => controller.abort()
  }, [listing.id, attempt])
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!detail || busy || reading) return
    const update: ListingUpdate = { id: listing.id }
    for (const key of [
      'title',
      'description',
      'category',
      'condition',
      'isbn',
    ] as const) {
      if (
        fields[key].trim() &&
        fields[key] !== detail[key] &&
        (key !== 'isbn' || fields.category === 'Textbooks')
      )
        update[key] = fields[key].trim()
    }
    if (Number(fields.price) !== detail.price)
      update.price = Number(fields.price)
    if (fields.status !== detail.status) update.status = fields.status
    const originalCount = detail.images_url?.length || 0
    const removed = Array.from({ length: originalCount }, (_, i) => i).filter(
      (i) => !images.some((image) => image.original === i),
    )
    const added = images.filter((image) => image.original === undefined)
    if (removed.length || added.length)
      update.imgs = [
        ...removed.map((location) => ({ action: 'delete' as const, location })),
        ...added.map((image) => ({
          action: 'insert' as const,
          location: -1,
          imageBase64: image.src,
        })),
      ]
    if (Object.keys(update).length === 1) {
      setError('Choose a change to save.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await marketplace.update(update, email)
      onSaved(result.message)
    } catch (e) {
      setError(errorMessage(e))
      onError(e)
    } finally {
      setBusy(false)
    }
  }
  const statuses = email
    ? ['Active', 'Inactive', 'Expired', 'Sold', 'Blocked', 'Renew']
    : ['Active', 'Inactive', 'Sold', 'Renew']
  return (
    <PortalDialog title="Edit listing" busy={busy || reading} onClose={onClose}>
      {error && (
        <p role="alert" className="admin-alert error">
          {error}
        </p>
      )}
      {!detail ? (
        <>
          <p role="status">
            {error ? 'Unable to load this listing.' : 'Loading listing…'}
          </p>
          {error && (
            <button
              className="admin-button"
              onClick={() => setAttempt((x) => x + 1)}
            >
              Retry
            </button>
          )}
        </>
      ) : (
        <form className="account-form listing-form" onSubmit={(event) => void save(event)}>
          <fieldset disabled={busy || reading}>
            <legend className="sr-only">Edit listing details</legend>
            <label>
              Title
              <input
                required
                maxLength={200}
                value={fields.title}
                onChange={(e) =>
                  setFields({ ...fields, title: e.target.value })
                }
              />
            </label>
            <label>
              Description
              <textarea
                maxLength={2000}
                rows={4}
                value={fields.description}
                onChange={(e) =>
                  setFields({ ...fields, description: e.target.value })
                }
              />
            </label>
            <label>
              Price ($)
              <input
                type="number"
                required
                min="0"
                max="99999999.99"
                step="0.01"
                value={fields.price}
                onChange={(e) =>
                  setFields({ ...fields, price: e.target.value })
                }
              />
            </label>
            {(['category', 'condition'] as const).map((key) => (
              <label key={key}>
                {key === 'category' ? 'Category' : 'Condition'}
                <select
                  value={fields[key]}
                  onChange={(e) =>
                    setFields({ ...fields, [key]: e.target.value })
                  }
                >
                  {[
                    ...new Set([
                      fields[key],
                      ...(key === 'category'
                        ? catalog.categories
                        : catalog.conditions),
                    ]),
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            ))}
            {fields.category === 'Textbooks' && (
              <label>
                ISBN
                <input
                  value={fields.isbn}
                  onChange={(e) =>
                    setFields({ ...fields, isbn: e.target.value })
                  }
                />
              </label>
            )}
            <label>
              Listing status
              <select
                aria-label="Listing status"
                value={fields.status}
                onChange={(e) =>
                  setFields({ ...fields, status: e.target.value })
                }
              >
                {[...new Set([detail.status, ...statuses])].map((value) => (
                  <option key={value} disabled={!statuses.includes(value)}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <p className="market-hint">
              Inactive hides the listing without deleting it. Sold stays visible
              in browse. Renew extends eligible listings and returns them to
              Active; the service checks the renewal window. Blank descriptions
              and ISBNs keep the saved values.
            </p>
            <ol
              className="upload-photo-grid"
              aria-label="Listing photos to keep"
            >
              {images.map((image, i) => (
                <li key={`${image.original ?? 'new'}-${i}`}>
                  <img src={image.src} alt={`Listing photo ${i + 1}`} />
                  <button
                    type="button"
                    className="admin-button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() =>
                      setImages((current) =>
                        current.filter((_, index) => index !== i),
                      )
                    }
                  >
                    Remove photo
                  </button>
                </li>
              ))}
            </ol>
            <label>
              Add photos
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                disabled={images.length >= 8}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || [])
                  e.target.value = ''
                  if (!files.length) return
                  if (
                    images.length + files.length > 8 ||
                    files.some(
                      (file) =>
                        file.size > 2 * 1024 * 1024 ||
                        !['image/png', 'image/jpeg', 'image/webp'].includes(
                          file.type,
                        ),
                    )
                  ) {
                    setError(
                      'Choose up to 8 photos total, PNG, JPEG, or WebP, no larger than 2 MB each.',
                    )
                    return
                  }
                  setReading(true)
                  setError('')
                  try {
                    const added = await Promise.all(
                      files.map(
                        (file) =>
                          new Promise<string>((resolve, reject) => {
                            const reader = new FileReader()
                            reader.onload = () => resolve(String(reader.result))
                            reader.onerror = () =>
                              reject(new Error('Unable to read photo.'))
                            reader.readAsDataURL(file)
                          }),
                      ),
                    )
                    setImages((current) => [
                      ...current,
                      ...added.map((src) => ({ src })),
                    ])
                  } catch (e) {
                    setError(errorMessage(e))
                  } finally {
                    setReading(false)
                  }
                }}
              />
            </label>
            <p>
              {images.length} of 8 photos · remove an old photo and add a new
              one to replace it.
            </p>
            <div className="admin-dialog-actions">
              <button type="button" className="admin-button" onClick={onClose}>
                Cancel
              </button>
              <button className="admin-button primary">
                {busy
                  ? 'Saving…'
                  : reading
                    ? 'Reading photos…'
                    : 'Save listing'}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </PortalDialog>
  )
}
