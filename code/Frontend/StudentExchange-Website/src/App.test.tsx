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
it('shows live listings, actual prices, full details, and a seller email link', async () => {
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
  expect(screen.getByRole('link', { name: 'Email seller ↗' })).toHaveAttribute(
    'href',
    expect.stringContaining('seller%40example.com'),
  )
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
