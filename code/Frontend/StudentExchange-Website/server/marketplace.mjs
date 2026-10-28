export const marketplaceRoutes = {
  '/api/listings': ['GET'],
  '/api/catalog': ['GET'],
  '/api/seller/listings': ['GET', 'POST', 'DELETE'],
  '/api/admin/listings': ['GET', 'DELETE'],
  '/api/admin/categories': ['POST'],
}

export function validIsbn(value) {
  const s = value.replace(/[-\s]/g, '').toUpperCase()
  if (/^\d{13}$/.test(s))
    return (
      [...s].reduce((sum, n, i) => sum + Number(n) * (i % 2 ? 3 : 1), 0) %
        10 ===
      0
    )
  return (
    /^\d{9}[\dX]$/.test(s) &&
    [...s].reduce(
      (sum, n, i) => sum + (n === 'X' ? 10 : Number(n)) * (10 - i),
      0,
    ) %
      11 ===
      0
  )
}

export async function handleMarketplace({
  path,
  method,
  request,
  response,
  call: upstreamCall,
  credentials,
  readBody,
  send,
  ApiError,
  adminStatus,
}) {
  const call = async (...args) => {
    try {
      return await upstreamCall(...args)
    } catch (error) {
      if (
        path.startsWith('/api/admin') &&
        error.status === 401 &&
        !error.sessionExpired
      )
        throw new ApiError(
          403,
          'Your administrator access does not permit this action for this user.',
        )
      throw error
    }
  }
  const fail = (status, text) => {
    throw new ApiError(status, text)
  }
  const exact = (data, keys) => {
    if (Object.keys(data).some((key) => !keys.includes(key)))
      fail(400, 'The request contains an unsupported field.')
  }
  const text = (value, max, required = false) => {
    if (value == null && !required) return ''
    if (
      typeof value !== 'string' ||
      value.length > max ||
      (required && !value.trim())
    )
      fail(400, 'Complete the fields within their length limits.')
    return value.trim()
  }
  const list = (data) => {
    if (!Array.isArray(data))
      fail(502, 'The listing service returned an unexpected response.')
    return data.map((row) => {
      if (
        !Number.isSafeInteger(row.id) ||
        typeof row.title !== 'string' ||
        typeof row.price !== 'number' ||
        !Number.isFinite(row.price) ||
        row.price < 0
      )
        fail(502, 'The listing service returned an unexpected listing.')
      const result = { id: row.id, title: row.title, price: row.price }
      for (const key of [
        'description',
        'category',
        'condition',
        'location',
        'isbn',
        'datetime',
        'email',
        'first_name',
        'last_name',
        'status',
      ])
        result[key] = typeof row[key] === 'string' ? row[key] : ''
      // Keep images on our origin. Never accept arbitrary URLs from upstream data.
      result.image_url = /^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(
        row.image_url,
      )
        ? `/api/listing-image?name=${row.image_url.split('/').pop()}`
        : null
      return result
    })
  }
  const directory = (data) => {
    if (
      !Array.isArray(data) ||
      data.some((x) => typeof x !== 'string' || !x.trim())
    )
      fail(502, 'The catalog could not be loaded.')
    return [...new Set(data)]
  }
  const url = new URL(request.url, 'http://website.local')
  const admin = path.startsWith('/api/admin')
  if (admin) {
    const access = adminStatus(await call('Admin', 'GET', credentials))
    if (!access.is_admin || access.level < 10)
      fail(403, 'Administrator level 10 is required.')
  }
  if (path === '/api/catalog') {
    const [categories, conditions] = await Promise.all([
      call('Category', 'GET', {}),
      call('Condition', 'GET', {}),
    ])
    send(response, 200, {
      categories: directory(categories),
      conditions: directory(conditions),
    })
    return
  }
  if (path === '/api/admin/categories') {
    const body = await readBody(request)
    exact(body, ['category'])
    const category = text(body.category, 200, true)
    await call('Category', 'POST', { category, ...credentials })
    send(response, 201, { message: 'Category created.' })
    return
  }
  const selectors = Object.fromEntries(url.searchParams)
  exact(
    selectors,
    admin
      ? ['email', 'category', 'search', 'isbn']
      : ['category', 'search', 'isbn'],
  )
  const fields = {}
  for (const key of ['category', 'search', 'isbn']) {
    if (selectors[key])
      fields[key] = text(selectors[key], key === 'search' ? 200 : 100)
  }
  if (fields.isbn && !validIsbn(fields.isbn))
    fail(400, 'Enter a valid ISBN-10 or ISBN-13.')
  if (admin) fields.to_user = text(selectors.email, 254, true)
  if (method === 'GET') {
    if (path !== '/api/listings')
      Object.assign(fields, credentials, { for_user: 'true' })
    send(response, 200, {
      listings: list(await call('Listing', 'GET', fields)),
    })
    return
  }
  const body = await readBody(request)
  if (method === 'DELETE') {
    exact(body, ['id'])
    if (!Number.isSafeInteger(body.id) || body.id <= 0)
      fail(400, 'Choose a valid listing.')
    await call('Listing', 'DELETE', {
      id: body.id,
      ...credentials,
      ...(admin ? { to_user: fields.to_user } : {}),
    })
    send(response, 200, { message: 'Listing deleted.' })
    return
  }
  exact(body, [
    'title',
    'description',
    'price',
    'category',
    'condition',
    'isbn',
    'imageBase64',
  ])
  const title = text(body.title, 200, true)
  const description = text(body.description, 2000)
  const category = text(body.category, 200, true)
  const condition = text(body.condition, 100, true)
  const isbn = text(body.isbn, 100)
  if (
    typeof body.price !== 'number' ||
    !Number.isFinite(body.price) ||
    body.price < 0 ||
    body.price > 99999999.99 ||
    Math.abs(body.price * 100 - Math.round(body.price * 100)) > 0.000001
  )
    fail(400, 'Enter a nonnegative price with at most two decimal places.')
  if (isbn && (category !== 'Textbooks' || !validIsbn(isbn)))
    fail(400, 'A valid ISBN can only be added to textbooks.')
  const imageBase64 = text(body.imageBase64, 2800000)
  if (imageBase64) {
    const raw = imageBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, '')
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4)
      fail(400, 'Choose a valid PNG, JPEG, or WebP image.')
    const bytes = Buffer.from(raw, 'base64')
    if (bytes.length < 12 || bytes.length > 2 * 1024 * 1024)
      fail(400, 'Images must be no larger than 2 MB.')
    if (
      !(
        bytes.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71])) ||
        bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
        (bytes.toString('ascii', 0, 4) === 'RIFF' &&
          bytes.toString('ascii', 8, 12) === 'WEBP')
      )
    )
      fail(400, 'Choose a PNG, JPEG, or WebP image.')
  }
  await call('Listing', 'POST', {
    title,
    description,
    price: body.price,
    category,
    condition,
    ...(isbn ? { isbn } : {}),
    ...(imageBase64 ? { imageBase64 } : {}),
    ...credentials,
  })
  send(response, 201, { message: 'Listing created.' })
}
