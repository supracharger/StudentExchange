import Messenger from './components/Messenger'
import type { MessageTarget } from './components/Messenger'
import { useEffect, useRef, useState } from 'react'
import logo from '../img/logo.png'
import AccountPanel from './components/AccountPanel'
import { useAccount } from './hooks/useAccount'
import { useAdmin } from './hooks/useAdmin'
import AdminPage from './components/AdminPage'
import Marketplace, { ListingDetail } from './components/Marketplace'
import SellerPortal from './components/SellerPortal'
import type { Listing } from './api/marketplace'
import './admin.css'
import './marketplace.css'

export default function App() {
  const [accountOpen, setAccountOpen] = useState(false)
  const accountButton = useRef<HTMLButtonElement>(null)
  const account = useAccount()
  const administration = useAdmin(account.profile, account.expire)
  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null)
  const [pendingMessage, setPendingMessage] = useState<Listing | null>(null)
  function contactSeller(listing: Listing) {
    if (!account.profile) {
      setPendingMessage(listing)
      setAccountOpen(true)
      return
    }
    setMessageTarget((current) => ({
      listing,
      sequence: (current?.sequence || 0) + 1,
    }))
  }
  useEffect(() => {
    if (account.profile && pendingMessage) {
      setMessageTarget((current) => ({
        listing: pendingMessage,
        sequence: (current?.sequence || 0) + 1,
      }))
      setPendingMessage(null)
      setAccountOpen(false)
    }
    if (!account.profile) setMessageTarget(null)
  }, [account.profile, pendingMessage])

  const [path, setPath] = useState(window.location.pathname)
  const [selected, setSelected] = useState<Listing | null>(null)
  useEffect(() => {
    const update = () => {
      setPath(window.location.pathname)
      setSelected(null)
      setAccountOpen(false)
    }
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  const sellerPage = path.startsWith('/sellers/')
  let sellerUsername = ''
  if (sellerPage) {
    try {
      const value = decodeURIComponent(
        path.slice('/sellers/'.length),
      ).toLowerCase()
      if (/^[a-z0-9_-]{1,50}$/.test(value)) sellerUsername = value
    } catch {
      /* Invalid encoded paths render a helpful page instead of crashing. */
    }
  }
  useEffect(() => {
    const previous = document.title
    if (sellerPage)
      document.title = sellerUsername
        ? `@${sellerUsername} listings | Student Exchange`
        : 'Seller not found | Student Exchange'
    return () => {
      document.title = previous
    }
  }, [sellerPage, sellerUsername])
  function navigate(next: string) {
    window.history.pushState(null, '', next)
    setPath(next)
    setPendingMessage(null)
    setSelected(null)
    setAccountOpen(false)
    window.scrollTo?.(0, 0)
  }
  function section(event: React.MouseEvent, id: string) {
    event.preventDefault()
    navigate(`/#${id}`)
    setTimeout(
      () =>
        document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth' }),
      0,
    )
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a
          className="brand"
          href="/"
          aria-label="Student Exchange home"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
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
          <a
            className="nav-browse"
            href="/#browse"
            onClick={(e) => section(e, 'browse')}
          >
            Browse
          </a>
          <a href="/#how-it-works" onClick={(e) => section(e, 'how-it-works')}>
            How it works
          </a>
          <a
            href="/seller"
            aria-current={path === '/seller' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault()
              navigate('/seller')
            }}
          >
            Seller portal
          </a>
        </nav>
        {administration.access?.is_admin && (
          <a
            className="admin-trigger"
            href="/admin"
            aria-current={path === '/admin' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault()
              navigate('/admin')
            }}
          >
            Admin console <span aria-hidden="true">↗</span>
          </a>
        )}
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
        {accountOpen && (
          <AccountPanel
            account={account}
            onClose={() => {
              setAccountOpen(false)
              setPendingMessage(null)
              accountButton.current?.focus()
            }}
          />
        )}
        {path === '/admin' ? (
          <AdminPage
            account={account}
            administration={administration}
            onLogin={() => setAccountOpen(true)}
            onBack={() => navigate('/')}
          />
        ) : path === '/seller' ? (
          <SellerPortal
            account={account}
            onLogin={() => setAccountOpen(true)}
          />
        ) : selected ? (
          <ListingDetail
            listing={selected}
            viewer={account.profile}
            onMessage={contactSeller}
            onSeller={(username) =>
              navigate(`/sellers/${encodeURIComponent(username)}`)
            }
            onBack={() => {
              setSelected(null)
              setTimeout(
                () => document.getElementById('browse')?.scrollIntoView?.(),
                0,
              )
            }}
          />
        ) : sellerPage ? (
          <>
            <div className="seller-page-back">
              <a href="/#browse" onClick={(event) => section(event, 'browse')}>
                ← Browse all listings
              </a>
            </div>
            {sellerUsername ? (
              <Marketplace
                key={sellerUsername}
                sellerUsername={sellerUsername}
                onSelect={(row) => {
                  setSelected(row)
                  window.scrollTo?.(0, 0)
                }}
              />
            ) : (
              <section className="seller-portal">
                <h1>Invalid seller address</h1>
                <p>
                  Use a seller username containing letters, numbers, hyphens, or
                  underscores.
                </p>
              </section>
            )}
          </>
        ) : (
          <>
            <section className="hero" aria-labelledby="hero-title">
              <div className="hero-copy">
                <p className="eyebrow">
                  <span aria-hidden="true">●</span> GOOD FINDS. GREAT
                  CONNECTIONS.
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
                <a
                  className="button-primary"
                  href="/#browse"
                  onClick={(e) => section(e, 'browse')}
                >
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

            <Marketplace
              onSelect={(row) => {
                setSelected(row)
                window.scrollTo?.(0, 0)
              }}
            />
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
                  Connect students with useful things that deserve another
                  semester.
                </p>
                <a
                  className="button-primary"
                  href="/seller"
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/seller')
                  }}
                >
                  Start selling ↗
                </a>
              </div>
              <ol className="steps">
                <li>
                  <span>01</span>
                  <div>
                    <h3>Find what you need</h3>
                    <p>
                      Browse live listings. Search by title, category, or
                      textbook ISBN.
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <h3>Message the seller</h3>
                    <p>
                      Use Messages to ask questions, send an offer, and arrange
                      a public meetup.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h3>Pass it forward</h3>
                    <p>
                      Create a listing in your seller portal. Arrange pickup and
                      payment directly; Student Exchange does not process
                      payments.
                    </p>
                  </div>
                </li>
              </ol>
            </section>
          </>
        )}
      </main>
      {account.profile && (
        <Messenger
          key={account.profile.email}
          target={messageTarget}
          onExpired={account.expire}
        />
      )}
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
