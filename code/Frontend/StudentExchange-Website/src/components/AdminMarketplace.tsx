import ListingEditor from './ListingEditor'
import { useEffect, useState } from 'react'
import { marketplace, money, errorMessage } from '../api/marketplace'
import type { Listing } from '../api/marketplace'
import { PortalDialog } from './SellerPortal'

export default function AdminMarketplace({
  onError,
}: {
  onError: (reason: unknown) => void
}) {
  const [email, setEmail] = useState('')
  const [owner, setOwner] = useState('')
  const [rows, setRows] = useState<Listing[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [category, setCategory] = useState('')
  const [removeCategory, setRemoveCategory] = useState('')
  const [pendingCategory, setPendingCategory] = useState('')
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Listing | null>(null)
  const [deactivating, setDeactivating] = useState<Listing | null>(null)
  useEffect(() => {
    if (!owner) return
    const controller = new AbortController()
    setLoaded(false)
    setRows([])
    setError('')
    setBusy(true)
    marketplace
      .adminInventory(owner, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setRows(result.listings)
          setLoaded(true)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(e))
          onError(e)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })
    return () => controller.abort()
  }, [owner, revision])
  return (
    <div className="admin-card">
      <h2>Listings and categories</h2>
      <p>
        Look up a seller’s complete inventory, including inactive listings.
        Listing updates follow the backend’s account hierarchy rules.
      </p>
      {error && (
        <p className="admin-alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-alert" role="status">
          {notice}
        </p>
      )}
      <form
        className="market-toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          setOwner(email.trim())
          setRevision((x) => x + 1)
        }}
      >
        <label>
          Seller email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button className="admin-button primary" disabled={busy}>
          Find listings
        </button>
      </form>
      {busy && <p role="status">Loading seller inventory…</p>}
      {loaded && (
        <>
          <h3>Inventory for {owner}</h3>
          {rows.length ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <caption className="sr-only">Seller inventory</caption>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{row.category}</td>
                      <td>{row.status}</td>
                      <td>{money(row.price)}</td>
                      <td>
                        <button
                          className="admin-button"
                          onClick={() => setEditing(row)}
                        >
                          Edit {row.title}
                        </button>
                        <button
                          className="admin-button destructive"
                          onClick={() => setDeactivating(row)}
                        >
                          Set Inactive: {row.title}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No listings found for this seller.</p>
          )}
        </>
      )}
      <hr />
      <h3>Add a category</h3>
      <p>
        New categories become available in listing creation and marketplace
        search.
      </p>
      <form
        className="market-toolbar"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          setNotice('')
          try {
            const result = await marketplace.addCategory(category.trim())
            setNotice(result.message)
            setCategory('')
          } catch (e) {
            setError(errorMessage(e))
            onError(e)
          } finally {
            setBusy(false)
          }
        }}
      >
        <label>
          Category name
          <input
            required
            maxLength={200}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <button className="admin-button primary" disabled={busy}>
          Add category
        </button>
      </form>
      <h3>Delete a category</h3>
      <p>
        Remove a category only when it is no longer needed. Existing listings
        may prevent deletion.
      </p>
      <form
        className="market-toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          setPendingCategory(removeCategory.trim())
        }}
      >
        <label>
          Category to delete
          <input
            required
            value={removeCategory}
            onChange={(e) => setRemoveCategory(e.target.value)}
          />
        </label>
        <button className="admin-button destructive" disabled={busy}>
          Review category deletion
        </button>
      </form>
      {pendingCategory && (
        <PortalDialog
          title="Delete category?"
          busy={busy}
          onClose={() => setPendingCategory('')}
        >
          <p>Delete “{pendingCategory}” from the catalog?</p>
          {error && <p role="alert">{error}</p>}
          <div className="admin-dialog-actions">
            <button
              className="admin-button"
              disabled={busy}
              onClick={() => setPendingCategory('')}
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
                  const result =
                    await marketplace.deleteCategory(pendingCategory)
                  setNotice(result.message)
                  setPendingCategory('')
                  setRemoveCategory('')
                } catch (e) {
                  setError(errorMessage(e))
                  onError(e)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Delete category
            </button>
          </div>
        </PortalDialog>
      )}
      {editing && (
        <ListingEditor
          listing={editing}
          email={owner}
          onClose={() => setEditing(null)}
          onError={onError}
          onSaved={(message) => {
            setEditing(null)
            setNotice(message)
            setRevision((x) => x + 1)
          }}
        />
      )}
      {deactivating && (
        <PortalDialog
          title="Set seller listing to Inactive?"
          busy={busy}
          onClose={() => setDeactivating(null)}
        >
          <p>
            Hide “{deactivating.title}” from browse for {owner}? The listing and
            photos will be preserved.
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
                  const result = await marketplace.adminDeactivate(
                    deactivating.id,
                    owner,
                  )
                  setNotice(result.message)
                  setDeactivating(null)
                  setRevision((x) => x + 1)
                } catch (e) {
                  setError(errorMessage(e))
                  onError(e)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Set Inactive
            </button>
          </div>
        </PortalDialog>
      )}
    </div>
  )
}
