import { useEffect, useState } from 'react'
import { marketplace, money, errorMessage } from '../api/marketplace'
import type { Listing, Catalog } from '../api/marketplace'

export function ListingArt({ listing }: { listing: Listing }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [listing.image_url])
  return listing.image_url && !failed ? (
    <img
      className="market-image"
      src={listing.image_url}
      alt={listing.title}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="market-placeholder">
      <span aria-hidden="true">
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="10" y="6" width="28" height="36" rx="3" />
          <path d="M16 6v36M22 16h10M22 22h7M10 36h28" />
        </svg>
      </span>
      <span>{listing.category}</span>
      <small>No photo available</small>
    </div>
  )
}

export function ListingDetail({
  listing: initialListing,
  onBack,
}: {
  listing: Listing
  onBack: () => void
}) {
  const [listing, setListing] = useState(initialListing)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [photo, setPhoto] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setPhoto(0)
    marketplace
      .detail(initialListing.id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setListing(result.listing)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [initialListing.id, attempt])
  const images =
    listing.images_url || (listing.image_url ? [listing.image_url] : [])
  return (
    <section className="product-page">
      <button className="product-back" onClick={onBack}>
        ← Back to listings
      </button>
      {loading ? (
        <p role="status">Loading listing details…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            className="admin-button"
            onClick={() => setAttempt((x) => x + 1)}
          >
            Retry details
          </button>
        </div>
      ) : (
        <div className="product-layout">
          <div className="product-left">
            <ListingArt
              listing={{ ...listing, image_url: images[photo] || null }}
            />
            {images.length > 1 && (
              <div
                className="photo-selector"
                role="group"
                aria-label="Listing photos"
              >
                {images.map((src, i) => (
                  <button
                    key={src}
                    aria-label={`View photo ${i + 1}`}
                    aria-pressed={photo === i}
                    onClick={() => setPhoto(i)}
                  >
                    <img src={src} alt={`Photo ${i + 1} of ${images.length}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="product-right">
            <p className="eyebrow">THE CAMPUS COLLECTION</p>
            <h1>{listing.title}</h1>
            <h2>{money(listing.price)}</h2>
            <div className="product-information">
              <p>
                <strong>Category:</strong> {listing.category}
              </p>
              <p>
                <strong>Condition:</strong> {listing.condition}
              </p>
              {listing.location && (
                <p>
                  <strong>Location:</strong> {listing.location}
                </p>
              )}
              {listing.isbn && (
                <p>
                  <strong>ISBN:</strong> {listing.isbn}
                </p>
              )}
            </div>
            <p className="listing-description">
              {listing.description || 'No description provided.'}
            </p>
            <p>
              Listed by{' '}
              <strong>
                {listing.user ||
                  `${listing.first_name} ${listing.last_name}`.trim() ||
                  'Student seller'}
              </strong>
            </p>
            {/^sample\.seller\.[1-5]@example\.com$/.test(listing.email) ? (
              <p className="sample-listing-note">
                Sample listing · This item and seller are examples, not
                available for purchase.
              </p>
            ) : listing.email ? (
              <a
                className="button-primary"
                href={`mailto:${encodeURIComponent(listing.email)}?subject=${encodeURIComponent(`Student Exchange: ${listing.title}`)}`}
              >
                Email seller ↗
              </a>
            ) : (
              <p>Seller contact is unavailable.</p>
            )}
            <p className="market-hint">
              Ask questions and agree on pickup and payment directly with the
              seller. Meet in a public place on campus.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

export default function Marketplace({
  onSelect,
}: {
  onSelect: (listing: Listing) => void
}) {
  const [catalog, setCatalog] = useState<Catalog>({
    categories: [],
    conditions: [],
  })
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [isbn, setIsbn] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [catalogError, setCatalogError] = useState('')
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState(1)
  const [condition, setCondition] = useState('')
  const [location, setLocation] = useState('')
  const [sort, setSort] = useState('relevance')
  useEffect(() => {
    const controller = new AbortController()
    setCatalogError('')
    marketplace
      .catalog(controller.signal)
      .then(setCatalog)
      .catch((e) => {
        if (!controller.signal.aborted) setCatalogError(errorMessage(e))
      })
    return () => controller.abort()
  }, [retry])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setRows([])
    setPage(1)
    marketplace
      .listings(filters, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setRows(result.listings)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [filters, retry])
  let visible = rows.filter(
    (row) =>
      (!condition || row.condition === condition) &&
      (!location || row.location === location),
  )
  if (sort !== 'relevance')
    visible = [...visible].sort((a, b) =>
      sort === 'low'
        ? a.price - b.price
        : sort === 'high'
          ? b.price - a.price
          : b.datetime.localeCompare(a.datetime),
    )
  const pages = Math.max(1, Math.ceil(visible.length / 12))
  const current = Math.min(page, pages)
  function clear() {
    setSearch('')
    setCategory('')
    setIsbn('')
    setCondition('')
    setLocation('')
    setSort('relevance')
    setFilters({})
  }
  return (
    <section id="browse" className="marketplace" aria-labelledby="browse-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE CAMPUS COLLECTION</p>
          <h2 id="browse-title">Find your next good thing.</h2>
        </div>
        <span className="sample-label">From your student community</span>
      </div>
      <form
        className="market-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setFilters(
            Object.fromEntries(
              Object.entries({
                search: search.trim(),
                category,
                isbn: isbn.trim(),
              }).filter(([, v]) => v),
            ),
          )
        }}
      >
        <label className="market-query">
          Search listings
          <input
            type="search"
            value={search}
            maxLength={200}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles — closest matches first…"
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              if (e.target.value && e.target.value !== 'Textbooks') setIsbn('')
            }}
          >
            <option value="">All categories</option>
            {catalog.categories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          ISBN (optional)
          <input
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            maxLength={100}
            placeholder="ISBN-10 or ISBN-13"
            disabled={Boolean(category && category !== 'Textbooks')}
          />
        </label>
        <button className="button-primary">Search</button>
      </form>
      {catalogError && (
        <p role="alert">
          Filters unavailable: {catalogError}{' '}
          <button onClick={() => setRetry((x) => x + 1)}>Retry</button>
        </p>
      )}
      <div className="market-toolbar">
        <label>
          Condition
          <select
            value={condition}
            onChange={(e) => {
              setCondition(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Any condition</option>
            {catalog.conditions.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Location
          <select
            value={location}
            onChange={(e) => {
              setLocation(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All locations</option>
            {[...new Set(rows.map((x) => x.location).filter(Boolean))]
              .sort()
              .map((x) => (
                <option key={x}>{x}</option>
              ))}
          </select>
        </label>
        <label>
          Sort by
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              setPage(1)
            }}
          >
            <option value="relevance">Best match</option>
            <option value="new">Newest</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </label>
        <button className="admin-button" onClick={clear}>
          Clear filters
        </button>
      </div>
      {loading ? (
        <p role="status">Loading listings…</p>
      ) : error ? (
        <div className="empty-state">
          <h3>Listings unavailable</h3>
          <p role="alert">{error}</p>
          <button onClick={() => setRetry((x) => x + 1)}>Try again</button>
        </div>
      ) : (
        <>
          <p className="result-count" role="status">
            {visible.length} {visible.length === 1 ? 'listing' : 'listings'}
            {filters.search ? ' · ranked by title similarity' : ''}
          </p>
          {visible.length ? (
            <>
              <ul className="listing-grid" aria-label="Listings">
                {visible.slice((current - 1) * 12, current * 12).map((row) => (
                  <li key={row.id}>
                    <button
                      className="listing-card market-card"
                      onClick={() => onSelect(row)}
                    >
                      <ListingArt listing={row} />
                      <div className="listing-details">
                        <div className="listing-meta">
                          <span>{row.category}</span>
                          <span>{row.condition}</span>
                        </div>
                        <h3>{row.title}</h3>
                        {(/\(sample\)$/i.test(row.title) ||
                          /^sample\.seller\.[1-5]@example\.com$/.test(
                            row.email,
                          )) && (
                          <span className="sample-listing-badge">
                            Sample listing
                          </span>
                        )}
                        <div className="listing-bottom">
                          <strong>{money(row.price)}</strong>
                          <span>
                            {row.location || 'Ask seller for location'}
                          </span>
                        </div>
                      </div>
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
              <h3>No matching listings</h3>
              <p>Try another category or ISBN, or check back for new finds.</p>
              <button onClick={clear}>Clear filters</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
