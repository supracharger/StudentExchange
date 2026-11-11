import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import ListingEditor from './ListingEditor'
import { marketplace } from '../api/marketplace'
import type { Listing } from '../api/marketplace'
const listing: Listing = {
  id: 5,
  title: 'Calculus',
  description: 'Used book',
  price: 12,
  category: 'Textbooks',
  condition: 'Good',
  isbn: '',
  status: 'Active',
  email: 'seller@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  user: 'jane',
  location: 'Campus',
  datetime: '2026-11-07T10:00:00',
  image_url: '/api/listing-image?name=one',
  images_url: ['/api/listing-image?name=one', '/api/listing-image?name=two'],
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
  vi.spyOn(marketplace, 'detail').mockResolvedValue({ listing })
  vi.spyOn(marketplace, 'catalog').mockResolvedValue({
    categories: ['Textbooks'],
    conditions: ['Good', 'New'],
  })
  vi.spyOn(marketplace, 'update').mockResolvedValue({
    message: 'Listing updated.',
  })
})
it('saves changed fields, status and photo operations without deleting the listing', async () => {
  const user = userEvent.setup(),
    saved = vi.fn()
  render(
    <ListingEditor
      listing={listing}
      onClose={vi.fn()}
      onSaved={saved}
      onError={vi.fn()}
    />,
  )
  await screen.findByDisplayValue('Calculus')
  await user.clear(screen.getByLabelText('Title'))
  await user.type(screen.getByLabelText('Title'), 'Calculus bundle')
  await user.selectOptions(screen.getByLabelText('Listing status'), 'Sold')
  await user.click(screen.getByRole('button', { name: 'Remove photo 1' }))
  await user.upload(
    screen.getByLabelText('Add photos'),
    new File(['new'], 'new.png', { type: 'image/png' }),
  )
  await waitFor(() => expect(screen.getByText(/2 of 8 photos/)).toBeVisible())
  await user.click(screen.getByRole('button', { name: 'Save listing' }))
  await waitFor(() =>
    expect(marketplace.update).toHaveBeenCalledWith(
      {
        id: 5,
        title: 'Calculus bundle',
        status: 'Sold',
        imgs: [
          { action: 'delete', location: 0 },
          {
            action: 'insert',
            location: -1,
            imageBase64: 'data:image/png;base64,bmV3',
          },
        ],
      },
      undefined,
    ),
  )
  expect(saved).toHaveBeenCalledWith('Listing updated.')
})
it('offers restricted statuses only in the administrator editor', async () => {
  const { unmount } = render(
    <ListingEditor
      listing={listing}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onError={vi.fn()}
    />,
  )
  await screen.findByDisplayValue('Calculus')
  expect(
    screen.queryByRole('option', { name: 'Blocked' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('option', { name: 'Renew' }),
  ).toBeVisible()
  unmount()
  render(
    <ListingEditor
      listing={listing}
      email="seller@example.com"
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onError={vi.fn()}
    />,
  )
  await screen.findByDisplayValue('Calculus')
  expect(
    screen.getByRole('option', { name: 'Blocked' }),
  ).toBeVisible()
})
