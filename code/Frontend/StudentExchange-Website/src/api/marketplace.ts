import { request } from './accounts'
export interface Listing {
  id: number
  title: string
  description: string
  price: number
  category: string
  condition: string
  location: string
  isbn: string
  image_url: string | null
  datetime: string
  email: string
  first_name: string
  last_name: string
  status: string
}
export interface Catalog {
  categories: string[]
  conditions: string[]
}
export interface ListingDraft {
  title: string
  description: string
  price: number
  category: string
  condition: string
  isbn?: string
  imageBase64?: string
}
export const marketplace = {
  catalog: (signal?: AbortSignal) =>
    request<Catalog>('catalog', 'GET', undefined, signal),
  listings: (filters: Record<string, string> = {}, signal?: AbortSignal) =>
    request<{ listings: Listing[] }>(
      `listings?${new URLSearchParams(filters)}`,
      'GET',
      undefined,
      signal,
    ),
  inventory: (signal?: AbortSignal) =>
    request<{ listings: Listing[] }>(
      'seller/listings',
      'GET',
      undefined,
      signal,
    ),
  create: (draft: ListingDraft) =>
    request<{ message: string }>('seller/listings', 'POST', draft),
  remove: (id: number) =>
    request<{ message: string }>('seller/listings', 'DELETE', { id }),
  adminInventory: (email: string, signal?: AbortSignal) =>
    request<{ listings: Listing[] }>(
      `admin/listings?${new URLSearchParams({ email })}`,
      'GET',
      undefined,
      signal,
    ),
  adminRemove: (id: number, email: string) =>
    request<{ message: string }>(
      `admin/listings?${new URLSearchParams({ email })}`,
      'DELETE',
      { id },
    ),
  addCategory: (category: string) =>
    request<{ message: string }>('admin/categories', 'POST', { category }),
}
export const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    value,
  )
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unable to complete this request.'
