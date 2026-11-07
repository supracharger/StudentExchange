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
  vi.spyOn(marketplace, 'deactivate').mockResolvedValue({
    message: 'Listing set to Inactive.',
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
it('requires confirmation before deactivating and refreshes inventory after success', async () => {
  const user = userEvent.setup()
  render(<SellerPortal account={account} onLogin={vi.fn()} />)
  await user.click(
    await screen.findByRole('button', { name: 'Set Inactive: Calculus' }),
  )
  expect(marketplace.deactivate).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(marketplace.deactivate).not.toHaveBeenCalled()
  await user.click(
    screen.getByRole('button', { name: 'Set Inactive: Calculus' }),
  )
  await user.click(screen.getByRole('button', { name: 'Set Inactive' }))
  await waitFor(() => expect(marketplace.deactivate).toHaveBeenCalledWith(5))
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
it('adds photos across selections, changes cover, removes one, and publishes the ordered array', async () => {
  const user = userEvent.setup()
  render(<SellerPortal account={account} onLogin={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Calculus' })
  await user.click(screen.getByRole('button', { name: '＋ Create listing' }))
  const upload = screen.getByLabelText('Photo (optional)')
  await user.upload(
    upload,
    new File(['first'], 'front.png', { type: 'image/png' }),
  )
  await screen.findByAltText('Listing photo preview 1')
  await user.upload(
    upload,
    new File(['second'], 'back.png', { type: 'image/png' }),
  )
  await screen.findByAltText('Listing photo preview 2')
  expect(screen.getByText('2 of 8 photos added')).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Make photo 2 the cover' }),
  )
  expect(screen.getByAltText('Listing photo preview 1')).toHaveAttribute(
    'src',
    'data:image/png;base64,c2Vjb25k',
  )
  await user.upload(
    upload,
    new File(['third'], 'spine.png', { type: 'image/png' }),
  )
  await screen.findByAltText('Listing photo preview 3')
  await user.click(screen.getByRole('button', { name: 'Remove photo 2' }))
  expect(
    screen.queryByAltText('Listing photo preview 3'),
  ).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Title'), 'Multi photo book')
  await user.type(screen.getByLabelText('Price ($)'), '12')
  await user.selectOptions(screen.getByLabelText('Condition'), 'Good')
  await user.click(screen.getByRole('button', { name: 'Publish listing' }))
  await waitFor(() =>
    expect(marketplace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBase64: [
          'data:image/png;base64,c2Vjb25k',
          'data:image/png;base64,dGhpcmQ=',
        ],
      }),
    ),
  )
})
it('retains selected photos when an added batch would exceed eight', async () => {
  const user = userEvent.setup()
  render(<SellerPortal account={account} onLogin={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Calculus' })
  await user.click(screen.getByRole('button', { name: '＋ Create listing' }))
  const upload = screen.getByLabelText('Photo (optional)')
  await user.upload(
    upload,
    new File(['first'], 'one.png', { type: 'image/png' }),
  )
  await screen.findByAltText('Listing photo preview 1')
  await user.upload(
    upload,
    Array.from(
      { length: 8 },
      (_, i) => new File(['more'], `${i}.png`, { type: 'image/png' }),
    ),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('no more than 8')
  expect(screen.getByAltText('Listing photo preview 1')).toBeVisible()
  expect(
    screen.queryByAltText('Listing photo preview 2'),
  ).not.toBeInTheDocument()
})

it('marks a listing Sold directly from inventory without opening the editor', async () => {
  const update = vi
    .spyOn(marketplace, 'update')
    .mockResolvedValue({ message: 'Listing updated.' })
  const user = userEvent.setup()
  render(<SellerPortal account={account} onLogin={vi.fn()} />)
  await user.click(
    await screen.findByRole('button', { name: 'Mark Calculus as Sold' }),
  )
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({ id: 5, status: 'Sold' }),
  )
  expect(await screen.findByText('“Calculus” is now Sold.')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Mark Calculus as Sold' }),
  ).toBeDisabled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('keeps the listing unchanged and lets sellers retry when marking Sold fails', async () => {
  vi.spyOn(marketplace, 'update').mockRejectedValue(
    new Error('Service unavailable.'),
  )
  const user = userEvent.setup()
  render(<SellerPortal account={account} onLogin={vi.fn()} />)
  await user.click(
    await screen.findByRole('button', { name: 'Mark Calculus as Sold' }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Service unavailable.',
  )
  expect(
    screen.getByRole('button', { name: 'Mark Calculus as Sold' }),
  ).toBeEnabled()
  expect(
    screen.getByText('Active', { exact: true, selector: 'span' }),
  ).toBeVisible()
})
