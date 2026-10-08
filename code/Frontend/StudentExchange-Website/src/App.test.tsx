import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accounts, AccountApiError } from './api/accounts'
import App from './App'

describe('sample marketplace', () => {
  beforeEach(() => {
    vi.spyOn(accounts, 'profile').mockRejectedValue(
      new AccountApiError(401, 'Please log in to continue.'),
    )
  })
  it('renders the starter and identifies the listings as examples', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'semester’s essentials',
    )
    expect(
      within(
        screen.getByRole('list', { name: 'Sample listings' }),
      ).getAllByRole('listitem'),
    ).toHaveLength(6)
    expect(screen.getByText('Sample listings · Demo only')).toBeVisible()
  })

  it('combines a category filter with a case-insensitive school search', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Textbooks' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'Search listings' }),
      '  cu DENVER  ',
    )
    expect(screen.getByRole('status')).toHaveTextContent('1 sample listing')
    expect(
      screen.getByRole('heading', { name: 'Calculus: Early Transcendentals' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Biology: Exploring Life' }),
    ).not.toBeInTheDocument()
  })

  it('lets users recover from an empty search by clearing both filters', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Electronics' }))
    await user.type(screen.getByRole('searchbox'), 'no matching product')
    expect(
      screen.getByRole('heading', { name: 'No matching listings' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'All items' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('status')).toHaveTextContent('6 sample listings')
  })
})
