import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import SellerPortal from './SellerPortal'
import { marketplace } from '../api/marketplace'
import { AccountApiError } from '../api/accounts'
import type { AccountState } from '../hooks/useAccount'

const profile = {
  email: 'seller@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  school: 'Campus',
}
const account = {
  profile,
  restoring: false,
  expire: vi.fn(),
} as unknown as AccountState
const book = {
  id: 5,
  title: 'Calculus',
  description: 'Useful',
  price: 10,
  category: 'Textbooks',
  condition: 'Good',
  isbn: '9780131103627',
  location: '',
  email: profile.email,
  first_name: 'Jane',
  last_name: 'Doe',
  image_url: null,
  datetime: '2026-10-27T12:00:00',
  status: 'Active',
}
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    },
  })
  vi.spyOn(marketplace, 'catalog').mockResolvedValue({
    categories: ['Textbooks', 'Electronics'],
    conditions: ['Good', 'New'],
  })
  vi.spyOn(marketplace, 'inventory').mockResolvedValue({ listings: [book] })
  vi.spyOn(marketplace, 'create').mockResolvedValue({
    message: 'Listing created.',
  })
  vi.spyOn(marketplace, 'remove').mockResolvedValue({
    message: 'Listing deleted.',
  })
})
it('publishes a listing using backend categories and allows a zero price', async () => {
  const user = userEvent.setup()
  render(<SellerPortal account={account} onLogin={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Calculus' })
  await user.click(screen.getByRole('button', { name: '＋ Create listing' }))
  await user.type(screen.getByLabelText('Title'), 'Free textbook')
  await user.type(screen.getByLabelText('Price ($)'), '0')
  await user.selectOptions(screen.getByLabelText('Condition'), 'Good')
  await user.type(screen.getByLabelText('ISBN (optional)'), '9780131103627')
  await user.click(screen.getByRole('button', { name: 'Publish listing' }))
  await waitFor(() =>
    expect(marketplace.create).toHaveBeenCalledWith({
      title: 'Free textbook',
      description: '',
      price: 0,
      category: 'Textbooks',
      condition: 'Good',
      isbn: '9780131103627',
    }),
  )
  expect(await screen.findByText('Listing created.')).toBeVisible()
})
it('requires confirmation before deleting and refreshes inventory after success', async () => {
  const user = userEvent.setup()
  render(<SellerPortal account={account} onLogin={vi.fn()} />)
  await user.click(
    await screen.findByRole('button', { name: 'Delete Calculus' }),
  )
  expect(marketplace.remove).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(marketplace.remove).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Delete Calculus' }))
  await user.click(screen.getByRole('button', { name: 'Delete listing' }))
  await waitFor(() => expect(marketplace.remove).toHaveBeenCalledWith(5))
  expect(marketplace.inventory).toHaveBeenCalledTimes(2)
})
it('rejects oversize images before publishing', async () => {
  const user = userEvent.setup()
  render(<SellerPortal account={account} onLogin={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Calculus' })
  await user.click(screen.getByRole('button', { name: '＋ Create listing' }))
  await user.upload(
    screen.getByLabelText('Photo (optional)'),
    new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'no larger than 2 MB',
  )
  expect(screen.getByRole('button', { name: 'Publish listing' })).toBeDisabled()
  expect(marketplace.create).not.toHaveBeenCalled()
})
it('expires the account after an authenticated inventory request loses its session', async () => {
  vi.mocked(marketplace.inventory).mockRejectedValue(
    new AccountApiError(401, 'Please log in.'),
  )
  render(<SellerPortal account={account} onLogin={vi.fn()} />)
  await waitFor(() => expect(account.expire).toHaveBeenCalled())
})
