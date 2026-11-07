import { request } from './accounts'
export interface Listing {
  hit?: number
  days?: number
  user?: string
  images_url?: string[]
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
  imageBase64?: string | string[]
}
export interface ListingUpdate {
  id: number
  title?: string
  description?: string
  price?: number
  category?: string
  condition?: string
  isbn?: string
  status?: string
  imgs?: {
    action: 'insert' | 'delete' | 'replace'
    location: number
    imageBase64?: string
  }[]
}
export const marketplace = {
  update: (fields: ListingUpdate, email?: string) =>
    request<{ message: string }>(
      email
        ? `admin/listings?${new URLSearchParams({ email })}`
        : 'seller/listings',
      'PATCH',
      fields,
    ),
  detail: (id: number, signal?: AbortSignal) =>
    request<{ listing: Listing }>(`listing?id=${id}`, 'GET', undefined, signal),
  deleteCategory: (category: string) =>
    request<{ message: string }>('admin/categories', 'DELETE', { category }),
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
  deactivate: (id: number) =>
    request<{ message: string }>('seller/listings', 'PATCH', {
      id,
      status: 'Inactive',
    }),
  adminInventory: (email: string, signal?: AbortSignal) =>
    request<{ listings: Listing[] }>(
      `admin/listings?${new URLSearchParams({ email })}`,
      'GET',
      undefined,
      signal,
    ),
  adminDeactivate: (id: number, email: string) =>
    request<{ message: string }>(
      `admin/listings?${new URLSearchParams({ email })}`,
      'PATCH',
      { id, status: 'Inactive' },
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
