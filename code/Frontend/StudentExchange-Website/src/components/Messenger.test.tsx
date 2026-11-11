import type { Conversation } from '../api/messages'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, it, expect, vi } from 'vitest'
import Messenger from './Messenger'
import { messaging } from '../api/messages'
import { AccountApiError } from '../api/accounts'
import type { Listing } from '../api/marketplace'
const listing: Listing = {
  id: 5,
  title: 'Calculus',
  description: 'Book',
  price: 20,
  category: 'Textbooks',
  condition: 'Good',
  location: 'Campus',
  isbn: '',
  email: 'seller@example.com',
  first_name: 'Alex',
  last_name: 'Lee',
  user: 'alex',
  datetime: '2026-11-11',
  status: 'Active',
  image_url: null,
}
const conversation: Conversation = {
  id: 7,
  listing_id: 5,
  listing_title: 'Calculus',
  other_name: 'Jane Doe',
  role: 'seller' as const,
  image_url: null,
  last_kind: 'message' as const,
  last_text: 'Available?',
  last_amount: null,
  last_datetime: '2026-11-11T12:00:00',
  last_from_me: false,
  unread: 1,
}
const message = {
  id: 1,
  mine: false,
  kind: 'message' as const,
  text: 'Available?',
  amount: null,
  datetime: '2026-11-11T12:00:00',
  read: false,
}
beforeEach(() => {
  vi.spyOn(messaging, 'unread').mockResolvedValue({ unread: 1 })
  vi.spyOn(messaging, 'conversations').mockResolvedValue({
    conversations: [conversation],
  })
  vi.spyOn(messaging, 'thread').mockResolvedValue({
    conversation_id: 7,
    messages: [message],
  })
  vi.spyOn(messaging, 'send').mockResolvedValue({
    conversation_id: 7,
    message: 'Message sent.',
  })
})
it('starts collapsed with an unread badge and reads a real conversation when selected', async () => {
  const user = userEvent.setup()
  render(<Messenger target={null} onExpired={vi.fn()} />)
  expect(
    screen.queryByRole('region', { name: 'Message inbox' }),
  ).not.toBeInTheDocument()
  await screen.findByLabelText('1 unread messages')
  expect(messaging.thread).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: /Messages/ }))
  await user.click(await screen.findByRole('button', { name: /Jane Doe/ }))
  expect(await screen.findByText('Available?')).toBeVisible()
  expect(messaging.thread).toHaveBeenCalledWith(7, 0, expect.any(AbortSignal))
  await user.click(screen.getByRole('button', { name: 'Minimize messages' }))
  expect(
    screen.queryByRole('region', { name: 'Message inbox' }),
  ).not.toBeInTheDocument()
})
it('starts from listing details and sends a real message rather than a local bubble', async () => {
  vi.mocked(messaging.conversations).mockResolvedValue({ conversations: [] })
  const user = userEvent.setup()
  render(<Messenger target={{ listing, sequence: 1 }} onExpired={vi.fn()} />)
  await user.type(
    await screen.findByRole('textbox', { name: 'Message text' }),
    'Can I collect tomorrow?',
  )
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() =>
    expect(messaging.send).toHaveBeenCalledWith(
      { listing_id: 5, kind: 'message', text: 'Can I collect tomorrow?' },
      expect.any(AbortSignal),
    ),
  )
  expect(await screen.findByText('Available?')).toBeVisible()
  expect(
    screen.queryByText('Can I collect tomorrow?', { selector: 'p' }),
  ).not.toBeInTheDocument()
})
it('sends an offer with amount through the selected conversation', async () => {
  const user = userEvent.setup()
  render(<Messenger target={null} onExpired={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: /Messages/ }))
  await user.click(await screen.findByRole('button', { name: /Jane Doe/ }))
  await user.click(screen.getByLabelText('Send an offer'))
  await user.type(screen.getByLabelText('Offer amount ($)'), '12.50')
  await user.click(screen.getByRole('button', { name: 'Send offer' }))
  await waitFor(() =>
    expect(messaging.send).toHaveBeenCalledWith(
      { conversation_id: 7, kind: 'offer', text: '', amount: 12.5 },
      expect.any(AbortSignal),
    ),
  )
})
it('keeps drafts and makes failed sends retryable without a fake delivered message', async () => {
  vi.mocked(messaging.conversations).mockResolvedValue({ conversations: [] })
  vi.mocked(messaging.send).mockRejectedValue(
    new AccountApiError(429, 'Please wait a minute.'),
  )
  const user = userEvent.setup()
  render(<Messenger target={{ listing, sequence: 1 }} onExpired={vi.fn()} />)
  await user.type(
    await screen.findByRole('textbox', { name: 'Message text' }),
    'My draft',
  )
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Please wait a minute.',
  )
  expect(screen.getByRole('textbox', { name: 'Message text' })).toHaveValue(
    'My draft',
  )
  expect(
    screen.queryByText('My draft', { selector: 'p' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Minimize messages' }))
  await user.click(screen.getByRole('button', { name: /Messages/ }))
  expect(screen.getByRole('textbox', { name: 'Message text' })).toHaveValue(
    'My draft',
  )
})
it('preserves a buyer draft while resolving the existing conversation', async () => {
  let resolve!: (value: { conversations: (typeof conversation)[] }) => void
  vi.mocked(messaging.conversations).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const user = userEvent.setup()
  render(<Messenger target={{ listing, sequence: 1 }} onExpired={vi.fn()} />)
  await user.type(
    await screen.findByRole('textbox', { name: 'Message text' }),
    'Keep this draft',
  )
  resolve({ conversations: [{ ...conversation, role: 'buyer' }] })
  await waitFor(() => expect(messaging.thread).toHaveBeenCalled())
  expect(screen.getByRole('textbox', { name: 'Message text' })).toHaveValue(
    'Keep this draft',
  )
})
it('expires the account when the backend reports an expired session', async () => {
  const expire = vi.fn()
  vi.mocked(messaging.unread).mockRejectedValue(
    new AccountApiError(401, 'Session expired.'),
  )
  render(<Messenger target={null} onExpired={expire} />)
  await waitFor(() => expect(expire).toHaveBeenCalled())
})
it('refreshes after a send even when a history read is still in flight', async () => {
  vi.mocked(messaging.conversations).mockResolvedValue({
    conversations: [{ ...conversation, role: 'buyer' }],
  })
  let resolve!: (value: {
    conversation_id: number
    messages: (typeof message)[]
  }) => void
  vi.mocked(messaging.thread)
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    .mockResolvedValue({
      conversation_id: 7,
      messages: [{ ...message, id: 2, mine: true, text: 'Newly sent' }],
    })
  const user = userEvent.setup()
  render(<Messenger target={{ listing, sequence: 1 }} onExpired={vi.fn()} />)
  await waitFor(() => expect(messaging.thread).toHaveBeenCalledTimes(1))
  await user.type(
    screen.getByRole('textbox', { name: 'Message text' }),
    'Newly sent',
  )
  await user.click(screen.getByRole('button', { name: 'Send message' }))
  await waitFor(() => expect(messaging.send).toHaveBeenCalledTimes(1))
  resolve({ conversation_id: 7, messages: [message] })
  expect(await screen.findByText('Newly sent', { selector: 'p' })).toBeVisible()
  expect(messaging.thread).toHaveBeenLastCalledWith(
    7,
    1,
    expect.any(AbortSignal),
  )
})
