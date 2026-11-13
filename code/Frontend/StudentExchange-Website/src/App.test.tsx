import { messaging } from './api/messages'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { accounts, AccountApiError } from './api/accounts'
import { marketplace } from './api/marketplace'
import type { Listing } from './api/marketplace'
import App from './App'

const calculus: Listing = {
  id: 101,
  title: 'Calculus textbook',
  description: 'A useful book.',
  price: 24.5,
  category: 'Textbooks',
  condition: 'Good',
  location: 'Denver',
  isbn: '9780131103627',
  image_url: null,
  email: 'seller@example.com',
  first_name: 'Alex',
  last_name: 'Lee',
  datetime: '2026-10-27T10:00:00',
  status: '',
}
const lamp = {
  ...calculus,
  id: 102,
  title: 'Desk lamp',
  price: 12,
  category: 'Campus living',
  condition: 'Like New',
  isbn: '',
}
beforeEach(() => {
  vi.spyOn(messaging, 'unread').mockResolvedValue({ unread: 0 })
  vi.spyOn(messaging, 'conversations').mockResolvedValue({ conversations: [] })
  window.history.replaceState(null, '', '/')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(accounts, 'profile').mockRejectedValue(
    new AccountApiError(401, 'Please log in.'),
  )
  vi.spyOn(marketplace, 'detail').mockResolvedValue({ listing: calculus })
  vi.spyOn(marketplace, 'catalog').mockResolvedValue({
    categories: ['Textbooks', 'Campus living'],
    conditions: ['Good', 'Like New'],
  })
  vi.spyOn(marketplace, 'listings').mockResolvedValue({
    listings: [calculus, lamp],
  })
})
it('shows live listings, actual prices, full details, and a seller messaging action', async () => {
  const user = userEvent.setup()
  render(<App />)
  expect(
    within(await screen.findByRole('list', { name: 'Listings' })).getAllByRole(
      'listitem',
    ),
  ).toHaveLength(2)
  expect(
    screen.queryByText('Sample listings · Demo only'),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Calculus textbook/ }))
  expect(await screen.findByText('A useful book.')).toBeVisible()
  expect(screen.getByText('Alex Lee')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Message seller' })).toBeVisible()
  expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
})
it('sends category, title, and ISBN together to server search', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('option', { name: 'Textbooks' })
  await user.selectOptions(screen.getByLabelText('Category'), 'Textbooks')
  await user.type(screen.getByRole('searchbox'), 'Calculus')
  await user.type(screen.getByLabelText('ISBN (optional)'), '978-0-13-110362-7')
  await user.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() =>
    expect(marketplace.listings).toHaveBeenLastCalledWith(
      { search: 'Calculus', category: 'Textbooks', isbn: '978-0-13-110362-7' },
      expect.any(AbortSignal),
    ),
  )
})
it('filters condition, sorts prices, and clears filters', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('list', { name: 'Listings' })
  await user.selectOptions(screen.getByLabelText('Sort by'), 'low')
  expect(
    within(screen.getByRole('list', { name: 'Listings' })).getAllByRole(
      'listitem',
    )[0],
  ).toHaveTextContent('Desk lamp')
  await user.selectOptions(screen.getByLabelText('Condition'), 'Good')
  expect(
    screen.queryByRole('heading', { name: 'Desk lamp' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(
    await screen.findByRole('heading', { name: 'Desk lamp' }),
  ).toBeVisible()
})
it('shows retryable failures without displaying sample offers', async () => {
  vi.mocked(marketplace.listings).mockRejectedValueOnce(
    new Error('Service unavailable.'),
  )
  const user = userEvent.setup()
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Service unavailable.',
  )
  expect(
    screen.queryByRole('list', { name: 'Listings' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(
    await screen.findByRole('heading', { name: 'Calculus textbook' }),
  ).toBeVisible()
})
it('opens the seller login gate from navigation and supports direct seller URLs', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('link', { name: 'Seller portal' }))
  expect(window.location.pathname).toBe('/seller')
  expect(
    await screen.findByRole('button', { name: 'Log in to start selling' }),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Log in to start selling' }),
  )
  expect(
    screen.getByRole('button', { name: 'Log in to your account' }),
  ).toBeVisible()
})
it('navigates all listing photos using thumbnails, buttons, and arrow keys', async () => {
  const user = userEvent.setup()
  const images = [
    '/api/listing-image?name=first.png',
    '/api/listing-image?name=second.png',
    '/api/listing-image?name=third.png',
  ]
  vi.mocked(marketplace.detail).mockResolvedValue({
    listing: { ...calculus, images_url: images, image_url: images[0] },
  })
  render(<App />)
  await user.click(
    await screen.findByRole('button', { name: /Calculus textbook/ }),
  )
  await screen.findByText('Photo 1 of 3')
  await user.click(screen.getByRole('button', { name: 'Next photo' }))
  expect(screen.getByAltText('Calculus textbook')).toHaveAttribute(
    'src',
    images[1],
  )
  await user.click(screen.getByRole('button', { name: 'View photo 3' }))
  expect(screen.getByText('Photo 3 of 3')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Next photo' }))
  expect(screen.getByText('Photo 1 of 3')).toBeVisible()
  screen.getByRole('region', { name: 'Listing photo gallery' }).focus()
  await user.keyboard('{ArrowLeft}')
  expect(screen.getByAltText('Calculus textbook')).toHaveAttribute(
    'src',
    images[2],
  )
})
it('labels Sold listings and disables seller contact for unavailable items', async () => {
  const user = userEvent.setup()
  vi.mocked(marketplace.detail).mockResolvedValue({
    listing: { ...calculus, status: 'Sold' },
  })
  render(<App />)
  await user.click(
    await screen.findByRole('button', { name: /Calculus textbook/ }),
  )
  expect(
    await screen.findByText(
      'This listing is sold and is not available for purchase.',
    ),
  ).toBeVisible()
  expect(
    screen.queryByRole('link', { name: 'Email seller ↗' }),
  ).not.toBeInTheDocument()
})
it('opens a public seller URL directly and keeps search/clear scoped to that seller', async () => {
  window.history.replaceState(null, '', '/sellers/alex_lee')
  const user = userEvent.setup()
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Listings from @alex_lee',
  )
  await waitFor(() =>
    expect(marketplace.listings).toHaveBeenCalledWith(
      { user_page: 'alex_lee' },
      expect.any(AbortSignal),
    ),
  )
  await user.type(screen.getByRole('searchbox'), 'calculus')
  await user.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() =>
    expect(marketplace.listings).toHaveBeenLastCalledWith(
      { user_page: 'alex_lee', search: 'calculus' },
      expect.any(AbortSignal),
    ),
  )
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  await waitFor(() =>
    expect(marketplace.listings).toHaveBeenLastCalledWith(
      { user_page: 'alex_lee' },
      expect.any(AbortSignal),
    ),
  )
})
it('links listing details to the seller public page and supports navigation back to all items', async () => {
  vi.mocked(marketplace.detail).mockResolvedValue({
    listing: { ...calculus, user: 'alex_lee' },
  })
  const user = userEvent.setup()
  render(<App />)
  await user.click(
    await screen.findByRole('button', { name: /Calculus textbook/ }),
  )
  const link = await screen.findByRole('link', {
    name: 'View all listings from @alex_lee →',
  })
  expect(link).toHaveAttribute('href', '/sellers/alex_lee')
  await user.click(link)
  expect(window.location.pathname).toBe('/sellers/alex_lee')
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    '@alex_lee',
  )
  await user.click(screen.getByRole('link', { name: '← Browse all listings' }))
  expect(window.location.pathname).toBe('/')
})
it('handles malformed seller URLs without sending an unscoped request', () => {
  window.history.replaceState(null, '', '/sellers/%ZZ')
  render(<App />)
  expect(
    screen.getByRole('heading', { name: 'Invalid seller address' }),
  ).toBeVisible()
  expect(marketplace.listings).not.toHaveBeenCalled()
})
it('shows a seller-specific empty state without falling back to other sellers', async () => {
  window.history.replaceState(null, '', '/sellers/no_public_items')
  vi.mocked(marketplace.listings).mockResolvedValue({ listings: [] })
  render(<App />)
  expect(
    await screen.findByText(
      'This seller has no public listings matching your filters. Clear filters or check back later.',
    ),
  ).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Calculus textbook' }),
  ).not.toBeInTheDocument()
  expect(marketplace.listings).toHaveBeenCalledWith(
    { user_page: 'no_public_items' },
    expect.any(AbortSignal),
  )
})
it('prompts a guest to log in before opening the listing messenger', async () => {
  const user = userEvent.setup()
  vi.spyOn(accounts, 'login').mockResolvedValue({
    profile: {
      email: 'buyer@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      school: 'Campus',
      user: 'jane',
      location: null,
    },
  })
  render(<App />)
  await user.click(
    await screen.findByRole('button', { name: /Calculus textbook/ }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Message seller' }),
  )
  expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await user.type(screen.getByLabelText('Email'), 'buyer@example.com')
  await user.type(
    screen.getByLabelText('Password', { exact: true }),
    'Buyer!123',
  )
  await user.click(
    screen.getByRole('button', { name: 'Log in to your account' }),
  )
  expect(
    await screen.findByRole('textbox', { name: 'Message text' }),
  ).toBeVisible()
  expect(
    screen.queryByRole('heading', { name: 'Your account' }),
  ).not.toBeInTheDocument()
})
