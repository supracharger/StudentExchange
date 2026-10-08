import { useRef, useState } from 'react'
import { categories, listings } from './data/listings'
import type { Category } from './data/listings'
import logo from '../img/logo.png'
import AccountPanel from './components/AccountPanel'
import { useAccount } from './hooks/useAccount'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export default function App() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category>('All items')
  const [accountOpen, setAccountOpen] = useState(false)
  const accountButton = useRef<HTMLButtonElement>(null)
  const account = useAccount()
  const query = search.trim().toLowerCase()
  const visibleListings = listings.filter(
    (listing) =>
      (category === 'All items' || listing.category === category) &&
      `${listing.title} ${listing.school} ${listing.category}`
        .toLowerCase()
        .includes(query),
  )

  function resetFilters() {
    setSearch('')
    setCategory('All items')
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Student Exchange home">
          <span className="brand-mark" aria-hidden="true">
            SE
          </span>
          <span>
            <strong>
              Student<span>Exchange</span>
            </strong>
            <small>BUY. SELL. CONNECT.</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-browse" href="#browse">
            Browse
          </a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <button
          className="account-trigger"
          ref={accountButton}
          aria-expanded={accountOpen}
          aria-controls="account"
          onClick={() => setAccountOpen(!accountOpen)}
        >
          {account.profile ? 'My account' : 'Log in / Join'}
        </button>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true">●</span> GOOD FINDS. GREAT CONNECTIONS.
            </p>
            <h1 id="hero-title">
              Find your next
              <br />
              semester’s essentials.
              <br />
              <span>For less.</span>
            </h1>
            <p className="hero-description">
              Textbooks, supplies, and everyday campus finds.
              <br className="desktop-break" /> A student marketplace built
              around your community.
            </p>
            <a className="button-primary" href="#browse">
              Explore the exchange
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 18 18 6M6 6h12v12" />
              </svg>
            </a>
            <p className="hero-note">
              Buy. Sell. Connect. Keep good things in circulation.
            </p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-caption">
              THE NEXT CHAPTER
              <br />
              <strong>starts here.</strong>
            </div>
            <div className="hero-book book-one">
              <span>THE ART OF</span>
              <strong>LEARNING</strong>
              <i />
            </div>
            <div className="hero-book book-two">
              <span>STUDENT EXCHANGE</span>
              <strong>
                Pass it
                <br />
                forward.
              </strong>
              <i />
            </div>
            <div className="art-sticker">
              Same campus.
              <br />
              <strong>New possibilities.</strong>
            </div>
          </div>
        </section>

        {accountOpen && (
          <AccountPanel
            account={account}
            onClose={() => {
              setAccountOpen(false)
              accountButton.current?.focus()
            }}
          />
        )}
        <section
          id="browse"
          className="marketplace"
          aria-labelledby="browse-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE CAMPUS COLLECTION</p>
              <h2 id="browse-title">A little of everything you need.</h2>
            </div>
            <span className="sample-label">Sample listings · Demo only</span>
          </div>
          <div className="search-bar" role="search">
            <span aria-hidden="true">⌕</span>
            <label className="sr-only" htmlFor="listing-search">
              Search listings
            </label>
            <input
              id="listing-search"
              type="search"
              placeholder="Search books, supplies, or schools…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="filters" role="group" aria-label="Filter by category">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <p className="result-count" role="status">
            {visibleListings.length}{' '}
            {visibleListings.length === 1
              ? 'sample listing'
              : 'sample listings'}
          </p>
          {visibleListings.length > 0 ? (
            <ul className="listing-grid" aria-label="Sample listings">
              {visibleListings.map((listing) => (
                <li key={listing.id}>
                  <article className="listing-card">
                    <div
                      className={`listing-art ${listing.cover}`}
                      aria-hidden="true"
                    >
                      <div className="item-cover">
                        <span>{listing.label}</span>
                        <i />
                      </div>
                    </div>
                    <div className="listing-details">
                      <div className="listing-meta">
                        <span>{listing.category}</span>
                        <span>{listing.condition}</span>
                      </div>
                      <h3>{listing.title}</h3>
                      <div className="listing-bottom">
                        <strong>{currency.format(listing.price)}</strong>
                        <span>
                          <span aria-hidden="true">⌖ </span>
                          {listing.school}
                        </span>
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <h3>No matching listings</h3>
              <p>Try another search or explore a different category.</p>
              <button type="button" onClick={resetFilters}>
                Clear filters
              </button>
            </div>
          )}
        </section>

        <section
          id="how-it-works"
          className="how-it-works"
          aria-labelledby="how-title"
        >
          <div className="how-intro">
            <p className="eyebrow">A BETTER WAY TO EXCHANGE</p>
            <h2 id="how-title">
              Good for your budget.
              <br />
              Great for your campus.
            </h2>
            <p>
              The idea is simple: connect students with useful things that
              deserve another semester.
            </p>
          </div>
          <ol className="steps">
            <li>
              <span>01</span>
              <div>
                <h3>Find what you need</h3>
                <p>Browse books and supplies from your student community.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Connect by email</h3>
                <p>
                  When live listings launch, contact sellers to ask questions
                  and arrange a meetup.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Exchange on your terms</h3>
                <p>
                  Arrange pickup and payment directly. Student Exchange won’t
                  process payments.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <aside className="demo-note">
          <strong>A first look at Student Exchange.</strong> These listings are
          examples. Accounts connect to the Student Exchange service; live
          listings and seller contact details are coming later.
        </aside>
      </main>
      <footer className="site-footer">
        <img
          src={logo}
          alt="Student Exchange — Buy, Sell, Connect"
          width="130"
          height="130"
        />
        <p>
          Made for students.
          <br />
          <span>Built for the next chapter.</span>
        </p>
        <a href="#main">Back to top ↑</a>
      </footer>
    </>
  )
}
