export const messageRoutes = {
  '/api/messages': ['GET', 'POST'],
  '/api/messages/unread': ['GET'],
  '/api/messages/thread': ['GET'],
}
export async function handleMessages({
  path,
  method,
  request,
  response,
  call,
  credentials,
  readBody,
  send,
  ApiError,
}) {
  const fail = (status, message) => {
    throw new ApiError(status, message)
  }
  const positive = (n) => Number.isSafeInteger(n) && n > 0
  const number = (n) => Number.isSafeInteger(n) && n >= 0
  const exact = (value, keys) => {
    if (Object.keys(value).some((key) => !keys.includes(key)))
      fail(400, 'Unsupported messaging field.')
  }
  const string = (value) => typeof value === 'string'
  const unexpected = () =>
    fail(502, 'The messaging service returned an unexpected response.')
  const image = (value) =>
    typeof value === 'string' &&
    /^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(value)
      ? `/api/listing-image?name=${value.split('/').pop()}`
      : null
  const params = Object.fromEntries(
    new URL(request.url, 'http://website.local').searchParams,
  )
  if (path === '/api/messages/thread') {
    exact(params, ['conversation_id', 'after'])
    const id = Number(params.conversation_id),
      after = Number(params.after || 0)
    if (!positive(id) || !number(after))
      fail(400, 'Choose a valid conversation and message cursor.')
    const result = await call(
      `api/Message/${id}?after=${after}`,
      'GET',
      credentials,
    )
    if (result?.conversation_id !== id || !Array.isArray(result.messages))
      unexpected()
    const messages = result.messages.map((row) => {
      if (
        !positive(row?.id) ||
        typeof row.mine !== 'boolean' ||
        !['message', 'offer'].includes(row.kind) ||
        !(row.text == null || string(row.text)) ||
        !string(row.datetime) ||
        typeof row.read !== 'boolean' ||
        (row.kind === 'offer' &&
          (typeof row.amount !== 'number' ||
            !Number.isFinite(row.amount) ||
            row.amount <= 0))
      )
        unexpected()
      return {
        id: row.id,
        mine: row.mine,
        kind: row.kind,
        text: row.text || '',
        amount: row.kind === 'offer' ? row.amount : null,
        datetime: row.datetime,
        read: row.read,
      }
    })
    send(response, 200, { conversation_id: id, messages })
    return
  }
  exact(params, [])
  if (path === '/api/messages/unread') {
    const result = await call('api/Message/unread', 'GET', credentials)
    if (!number(result?.unread)) unexpected()
    send(response, 200, { unread: result.unread })
    return
  }
  if (method === 'GET') {
    const result = await call('api/Message', 'GET', credentials)
    if (!Array.isArray(result)) unexpected()
    const conversations = result.map((row) => {
      if (
        !positive(row?.id) ||
        !positive(row.listing_id) ||
        !string(row.listing_title) ||
        !string(row.other_name) ||
        !['buyer', 'seller'].includes(row.role) ||
        !['message', 'offer'].includes(row.last_kind) ||
        !string(row.last_datetime) ||
        !number(row.unread) ||
        typeof row.last_from_me !== 'boolean' ||
        (row.last_text != null && !string(row.last_text)) ||
        (row.last_kind === 'offer' &&
          (typeof row.last_amount !== 'number' ||
            !Number.isFinite(row.last_amount) ||
            row.last_amount <= 0))
      )
        unexpected()
      return {
        id: row.id,
        listing_id: row.listing_id,
        listing_title: row.listing_title,
        other_name: row.other_name,
        role: row.role,
        image_url: image(row.image_url),
        last_kind: row.last_kind,
        last_text: row.last_text || '',
        last_amount: row.last_kind === 'offer' ? row.last_amount : null,
        last_datetime: row.last_datetime,
        last_from_me: row.last_from_me,
        unread: row.unread,
      }
    })
    send(response, 200, { conversations })
    return
  }
  const body = await readBody(request)
  exact(body, ['listing_id', 'conversation_id', 'kind', 'text', 'amount'])
  const hasListing = Object.hasOwn(body, 'listing_id'),
    hasConversation = Object.hasOwn(body, 'conversation_id')
  if (
    hasListing === hasConversation ||
    !positive(hasListing ? body.listing_id : body.conversation_id)
  )
    fail(400, 'Choose exactly one listing or conversation.')
  const kind = body.kind ?? 'message'
  if (
    !['message', 'offer'].includes(kind) ||
    (body.text != null && !string(body.text))
  )
    fail(400, 'Enter a valid message or offer.')
  const text = (body.text || '').trim()
  if (text.length > 1000 || (kind === 'message' && !text))
    fail(400, 'Messages need 1–1000 characters.')
  if (
    kind === 'offer' &&
    (typeof body.amount !== 'number' ||
      !Number.isFinite(body.amount) ||
      body.amount <= 0 ||
      body.amount > 1000000 ||
      Math.abs(body.amount * 100 - Math.round(body.amount * 100)) > 0.000001)
  )
    fail(
      400,
      'Offers must be greater than zero and at most $1,000,000, with up to two decimal places.',
    )
  if (kind === 'message' && Object.hasOwn(body, 'amount'))
    fail(400, 'Amounts are only allowed for offers.')
  const fields = {
    ...(hasListing
      ? { listing_id: body.listing_id }
      : { conversation_id: body.conversation_id }),
    kind,
    text,
    ...(kind === 'offer' ? { amount: body.amount } : {}),
    ...credentials,
  }
  const result = await call('api/Message', 'POST', fields)
  if (!positive(result?.conversation_id)) unexpected()
  send(response, 201, {
    conversation_id: result.conversation_id,
    message: kind === 'offer' ? 'Offer sent.' : 'Message sent.',
  })
}
