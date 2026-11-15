function fail(status, message) {
  const error = new Error(message)
  // Recognized by the existing adapter's safe error handler.
  error.name = 'AdminContractError'
  error.status = status
  throw error
}

export function marketplaceRoute(url) {
  const routes = {
    '/api/listings': ['Listing', 'listings'],
    '/api/categories': ['Category', 'names'],
    '/api/conditions': ['Condition', 'names'],
  }
  const detail = /^\/api\/listings\/([1-9][0-9]*)$/.exec(url.pathname)
  if (detail && !Number.isSafeInteger(Number(detail[1]))) fail(400, 'Invalid listing ID.')
  const match = routes[url.pathname] ?? (detail ? [`Listing/${detail[1]}`, 'detail'] : null)
  if (!match) return null
  return {
    route: match[0], kind: match[1],
    fields() {
      const allowed = match[1] === 'listings' ? ['search', 'category', 'isbn', 'user_page'] : []
      const fields = {}
      for (const [key, value] of url.searchParams) {
        if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1)
          fail(400, 'Unsupported or repeated marketplace filter.')
        if (!value.trim() || value.length > 200) fail(400, 'Invalid marketplace filter.')
        fields[key] = value.trim()
      }
      return fields
    },
  }
}

const common = ['title', 'price', 'category', 'condition', 'location', 'isbn', 'datetime', 'status', 'user']
function imagePath(value) {
  if (value === null) return null
  if (typeof value !== 'string' || !/^\/uploads\/[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp)$/.test(value))
    fail(502, 'The marketplace returned an unexpected image path.')
  return value
}
function listing(value, detail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(502, 'Invalid marketplace response.')
  const keys = detail ? [...common, 'description', 'first_name', 'last_name'] : ['id', ...common]
  const result = {}
  for (const key of keys) {
    const v = value[key]
    const valid = key === 'id' ? Number.isSafeInteger(v) && v > 0
      : key === 'price' ? typeof v === 'number' && Number.isFinite(v) && v >= 0
      : ['location', 'isbn'].includes(key) ? v === null || typeof v === 'string'
      : typeof v === 'string'
    if (!valid) fail(502, 'The marketplace returned an unexpected listing.')
    result[key] = v
  }
  if (value.days !== undefined) {
    if (typeof value.days !== 'number' || !Number.isFinite(value.days)) fail(502, 'Invalid listing expiry.')
    result.days = value.days
  }
  if (detail) {
    if (value.images_url !== null && !Array.isArray(value.images_url)) fail(502, 'Invalid marketplace images.')
    result.images_url = (value.images_url ?? []).map(imagePath)
  } else result.image_url = imagePath(value.image_url)
  // Seller email and unknown backend properties are intentionally not exposed.
  return result
}
export function marketplaceResponse(kind, data) {
  if (kind === 'detail') return listing(data, true)
  if (!Array.isArray(data)) fail(502, 'The marketplace returned an unexpected response.')
  if (kind === 'names') {
    if (!data.every(v => typeof v === 'string' && v.trim())) fail(502, 'Invalid marketplace directory.')
    return [...new Set(data)]
  }
  return data.map(v => listing(v, false))
}
