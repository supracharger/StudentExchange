import { useEffect, useRef, useState } from 'react'
import { AccountApiError } from '../api/accounts'
import { messaging } from '../api/messages'
import type { Conversation, Message } from '../api/messages'
import type { Listing } from '../api/marketplace'
import { errorMessage, money } from '../api/marketplace'
import './messenger.css'
export interface MessageTarget {
  listing: Listing
  sequence: number
}
type Selection = {
  id?: number
  listing_id: number
  title: string
  other: string
  role: 'buyer' | 'seller'
}
export default function Messenger({
  target,
  onExpired,
}: {
  target: MessageTarget | null
  onExpired: () => void
}) {
  const [open, setOpen] = useState(false),
    [selection, setSelection] = useState<Selection | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [messages, setMessages] = useState<Message[]>([])
  const [unread, setUnread] = useState(0),
    [syncError, setSyncError] = useState(''),
    [threadError, setThreadError] = useState(''),
    [sendError, setSendError] = useState('')
  const [loading, setLoading] = useState(false),
    [threadLoading, setThreadLoading] = useState(false),
    [sending, setSending] = useState(false),
    [more, setMore] = useState(false)
  const [revision, setRevision] = useState(0),
    [drafts, setDrafts] = useState<
      Record<string, { text: string; amount: string; offer: boolean }>
    >({})
  const expire = useRef(onExpired)
  expire.current = onExpired
  const refreshThread = useRef<() => Promise<void>>(async () => {})
  const mounted = useRef(true),
    sendController = useRef<AbortController | null>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  function minimize() {
    setOpen(false)
    launcher.current?.focus()
  }
  const body = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      sendController.current?.abort()
    }
  }, [])
  const key = selection
    ? selection.role === 'buyer'
      ? `l${selection.listing_id}`
      : `c${selection.id}`
    : ''
  const activeKey = useRef(key)
  activeKey.current = key
  const draft = drafts[key] || { text: '', amount: '', offer: false }
  function updateDraft(change: Partial<typeof draft>) {
    setDrafts((current) => ({ ...current, [key]: { ...draft, ...change } }))
    setSendError('')
  }
  function failure(error: unknown) {
    if (error instanceof AccountApiError && error.status === 401)
      expire.current()
    return errorMessage(error)
  }
  useEffect(() => {
    if (!target) return
    setSelection({
      listing_id: target.listing.id,
      title: target.listing.title,
      other:
        target.listing.user ||
        `${target.listing.first_name} ${target.listing.last_name}`.trim() ||
        'Seller',
      role: 'buyer',
    })
    setSendError('')
    setOpen(true)
  }, [target])
  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    async function sync() {
      if (pending) return
      pending = true
      if (open) setLoading(true)
      try {
        const badge = await messaging.unread(controller.signal)
        if (controller.signal.aborted) return
        setUnread(badge.unread)
        if (open) {
          const result = await messaging.conversations(controller.signal)
          if (controller.signal.aborted) return
          setConversations(result.conversations)
          setSelection((current) => {
            if (!current || current.id) return current
            const match = result.conversations.find(
              (row) =>
                row.listing_id === current.listing_id && row.role === 'buyer',
            )
            return match
              ? {
                  id: match.id,
                  listing_id: match.listing_id,
                  title: match.listing_title,
                  other: match.other_name,
                  role: match.role,
                }
              : current
          })
        }
        setSyncError('')
      } catch (error) {
        if (!controller.signal.aborted) setSyncError(failure(error))
      } finally {
        pending = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void sync()
    const timer = window.setInterval(() => {
      if (!document.hidden) void sync()
    }, 15000)
    const visible = () => {
      if (!document.hidden) void sync()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [open, revision])
  useEffect(() => {
    setMessages([])
    setMore(false)
    setSendError('')
    setThreadError('')
    if (!open || !selection?.id) {
      setThreadLoading(false)
      refreshThread.current = async () => {}
      return
    }
    const id = selection.id,
      controller = new AbortController()
    let cursor = 0,
      pending = false,
      queued = false
    async function load() {
      if (pending) {
        queued = true
        return
      }
      pending = true
      setThreadLoading(true)
      try {
        let page: Message[] = []
        const added: Message[] = []
        for (let i = 0; i < 10; i++) {
          const result = await messaging.thread(id, cursor, controller.signal)
          if (controller.signal.aborted) return
          page = result.messages
          if (page.some((row) => row.id <= cursor))
            throw new Error(
              'Message history could not be loaded. Please retry.',
            )
          added.push(...page)
          if (page.length) cursor = page[page.length - 1].id
          if (page.length < 200) break
        }
        if (controller.signal.aborted) return
        setMessages((current) => {
          const existing = new Set(current.map((row) => row.id))
          return [...current, ...added.filter((row) => !existing.has(row.id))]
        })
        setMore(page.length === 200)
        setConversations((current) =>
          current.map((row) => (row.id === id ? { ...row, unread: 0 } : row)),
        )
        const badge = await messaging.unread(controller.signal)
        if (!controller.signal.aborted) {
          setUnread(badge.unread)
          setThreadError('')
        }
      } catch (error) {
        if (!controller.signal.aborted) setThreadError(failure(error))
      } finally {
        pending = false
        if (!controller.signal.aborted) {
          setThreadLoading(false)
          if (queued) {
            queued = false
            void load()
          }
        }
      }
    }
    refreshThread.current = load
    void load()
    const timer = window.setInterval(() => {
      if (!document.hidden) void load()
    }, 10000)
    return () => {
      controller.abort()
      clearInterval(timer)
      refreshThread.current = async () => {}
    }
  }, [selection?.id, open])
  useEffect(() => {
    body.current?.scrollTo?.({
      top: body.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])
  useEffect(() => {
    if (open && selection) composer.current?.focus()
  }, [open, selection?.listing_id, selection?.id])
  function choose(row: Conversation) {
    setSelection({
      id: row.id,
      listing_id: row.listing_id,
      title: row.listing_title,
      other: row.other_name,
      role: row.role,
    })
    setSendError('')
  }
  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!selection || sending) return
    setSending(true)
    setSendError('')
    const controller = new AbortController()
    sendController.current = controller
    try {
      const result = await messaging.send(
        {
          ...(selection.id
            ? { conversation_id: selection.id }
            : { listing_id: selection.listing_id }),
          kind: draft.offer ? 'offer' : 'message',
          text: draft.text.trim(),
          ...(draft.offer ? { amount: Number(draft.amount) } : {}),
        },
        controller.signal,
      )
      if (!mounted.current || controller.signal.aborted) return
      setDrafts((current) => ({
        ...current,
        [key]: { text: '', amount: '', offer: false },
      }))
      if (activeKey.current !== key) {
        setRevision((x) => x + 1)
        return
      }
      if (selection.id === result.conversation_id) await refreshThread.current()
      else setSelection({ ...selection, id: result.conversation_id })
      setRevision((x) => x + 1)
    } catch (error) {
      if (
        mounted.current &&
        !controller.signal.aborted &&
        activeKey.current === key
      )
        setSendError(failure(error))
    } finally {
      if (mounted.current) setSending(false)
    }
  }
  return (
    <aside
      className={`messenger ${open ? 'is-open' : ''}`}
      aria-label="Student Exchange messages"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          minimize()
        }
      }}
    >
      <button
        type="button"
        className="messenger-launcher"
        ref={launcher}
        aria-expanded={open}
        aria-controls="messenger-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          Messages
          {unread > 0 && (
            <span
              className="messenger-badge"
              aria-label={`${unread} unread messages`}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
        <span aria-hidden="true">{open ? '−' : '↑'}</span>
      </button>
      {open && (
        <section
          id="messenger-panel"
          className="messenger-panel"
          aria-label="Message inbox"
        >
          <div className="messenger-toolbar">
            <strong>
              {selection ? selection.other : 'Your conversations'}
            </strong>
            <div>
              {selection && (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => setSelection(null)}
                >
                  ← Inbox
                </button>
              )}
              <button
                type="button"
                aria-label="Minimize messages"
                onClick={minimize}
              >
                Minimize
              </button>
            </div>
          </div>
          {(syncError || threadError) && (
            <div className="messenger-error" role="alert">
              {syncError || threadError}{' '}
              <button
                onClick={() => {
                  setSyncError('')
                  setThreadError('')
                  setRevision((x) => x + 1)
                  void refreshThread.current()
                }}
              >
                Retry
              </button>
            </div>
          )}
          {!selection ? (
            <div className="messenger-conversations">
              {loading && !conversations.length ? (
                <p role="status">Loading conversations…</p>
              ) : !conversations.length && !syncError ? (
                <div className="messenger-empty">
                  <h2>No conversations yet</h2>
                  <p>Open a listing and choose Message seller to start one.</p>
                </div>
              ) : null}
              <ul aria-label="Conversations">
                {conversations.map((row) => (
                  <li key={row.id}>
                    <button type="button" onClick={() => choose(row)}>
                      {row.image_url && <img src={row.image_url} alt="" />}
                      <span>
                        <strong>{row.other_name}</strong>
                        <span>{row.listing_title}</span>
                        <small>
                          {row.last_from_me ? 'You: ' : ''}
                          {row.last_kind === 'offer'
                            ? `Offer ${money(row.last_amount!)}`
                            : row.last_text}
                        </small>
                      </span>
                      {row.unread > 0 && (
                        <b className="messenger-badge">{row.unread}</b>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className="messenger-listing">
                {selection.title}
                <small>
                  {selection.role === 'buyer'
                    ? 'You’re the buyer'
                    : 'You’re the seller'}{' '}
                  · Times shown in Mountain time
                </small>
              </div>
              <div
                className="messenger-history"
                ref={body}
                role="log"
                aria-label="Conversation messages"
                aria-live="polite"
                aria-relevant="additions"
              >
                {threadLoading && !messages.length ? (
                  <p role="status">Loading messages…</p>
                ) : !messages.length ? (
                  <p className="messenger-hint">
                    {selection.id
                      ? 'No messages loaded yet.'
                      : 'Start a conversation about this listing.'}
                  </p>
                ) : null}
                {messages.map((row) => (
                  <div
                    className={`msg-bubble ${row.mine ? 'mine' : ''}`}
                    key={row.id}
                  >
                    {row.kind === 'offer' && (
                      <strong>Offer: {money(row.amount!)}</strong>
                    )}
                    {row.text && <p>{row.text}</p>}
                    <small>
                      {row.mine ? 'You · ' : ''}
                      <time dateTime={row.datetime}>
                        {row.datetime.replace('T', ' ').slice(0, 16)}
                      </time>
                    </small>
                  </div>
                ))}
                {more && (
                  <button
                    className="admin-button"
                    disabled={threadLoading}
                    onClick={() => void refreshThread.current()}
                  >
                    Load more messages
                  </button>
                )}
              </div>
              <form
                className="messenger-compose"
                onSubmit={(event) => void send(event)}
              >
                <fieldset disabled={sending}>
                  <legend className="sr-only">Send a message or offer</legend>
                  <label className="messenger-offer-toggle">
                    <input
                      type="checkbox"
                      checked={draft.offer}
                      onChange={(e) => updateDraft({ offer: e.target.checked })}
                    />
                    Send an offer
                  </label>
                  {draft.offer && (
                    <label>
                      Offer amount ($)
                      <input
                        type="number"
                        required
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        value={draft.amount}
                        onChange={(e) =>
                          updateDraft({ amount: e.target.value })
                        }
                      />
                    </label>
                  )}
                  <label>
                    <span className="sr-only">Message text</span>
                    <textarea
                      ref={composer}
                      value={draft.text}
                      required={!draft.offer}
                      maxLength={1000}
                      rows={2}
                      placeholder={
                        draft.offer
                          ? 'Add a note (optional)…'
                          : 'Write a message…'
                      }
                      onChange={(e) => updateDraft({ text: e.target.value })}
                    />
                  </label>
                  {sendError && (
                    <p className="messenger-error" role="alert">
                      {sendError} Your draft has been kept. Check the
                      conversation before trying again.
                    </p>
                  )}
                  <div className="messenger-send">
                    <small>{draft.text.length}/1000</small>
                    <button
                      type="submit"
                      disabled={sending || (!draft.offer && !draft.text.trim())}
                    >
                      {sending
                        ? 'Sending…'
                        : draft.offer
                          ? 'Send offer'
                          : 'Send message'}
                    </button>
                  </div>
                </fieldset>
              </form>
            </>
          )}
        </section>
      )}
    </aside>
  )
}
