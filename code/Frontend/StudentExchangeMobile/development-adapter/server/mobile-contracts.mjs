// Contracts inspected at group repository def6578c; no backend credentials are public fields.
export function invalid(message, status = 400) {
  const e = new Error(message); e.name = 'AdminContractError'; e.status = status; throw e
}
export function exact(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k)))
    invalid('Unsupported request field.')
}
export function positive(value) { return Number.isSafeInteger(value) && value > 0 }
export function listingFields(body, editing) {
  const allowed = ['title', 'description', 'price', 'category', 'condition', 'isbn', ...(editing ? ['status', 'imgs'] : ['imageBase64'])]
  exact(body, allowed)
  if (!Object.keys(body).length) invalid('Choose fields to update.')
  const out = { ...body }
  for (const [key, max] of [['title',200],['description',2000],['category',200],['condition',200],['isbn',32],['status',30]]) {
    if (key in body && (typeof body[key] !== 'string' || body[key].length > max || (!['description','isbn'].includes(key) && !body[key].trim()))) invalid('Invalid listing ' + key + '.')
  }
  if ((!editing || 'price' in body) && (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0)) invalid('Price must be nonnegative.')
  if (!editing && ['title','category','condition'].some(k => !body[k]?.trim())) invalid('Complete the listing fields.')
  if (body.status && !['Sold','Active','Renew'].includes(body.status)) invalid('Unsupported listing status.')
  function image(value) {
    if (typeof value !== 'string' || value.length > 2796304) invalid('Image must be under 2 MB.')
    const raw = value.replace(/^data:image\/(?:png|jpeg|webp);base64,/, '')
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4) invalid('Invalid image encoding.')
    const bytes = Buffer.from(raw, 'base64')
    const type = bytes.subarray(0,4).equals(Buffer.from([137,80,78,71])) || (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) || (bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP')
    if (bytes.length < 12 || bytes.length > 2*1024*1024 || !type) invalid('Use a PNG, JPEG or WebP under 2 MB.')
  }
  if (body.imageBase64 !== undefined) {
    if (!Array.isArray(body.imageBase64) || body.imageBase64.length > 8) invalid('At most eight images are allowed.')
    body.imageBase64.forEach(image)
  }
  if (body.imgs !== undefined) {
    if (!Array.isArray(body.imgs) || body.imgs.length > 8) invalid('At most eight image operations are allowed.')
    for (const img of body.imgs) {
      exact(img, ['action','location','imageBase64'])
      if (!['insert','replace','delete'].includes(img.action) || !Number.isSafeInteger(img.location) || img.location < -1 || img.location > 7) invalid('Invalid image operation.')
      if (img.action !== 'insert' && img.location < 0) invalid('Invalid image location.')
      if (img.action !== 'delete') image(img.imageBase64)
    }
  }
  return out
}
export function messageFields(body) {
  exact(body, ['listing_id','conversation_id','kind','text','amount'])
  if (positive(body.listing_id) === positive(body.conversation_id)) invalid('Choose one listing or conversation.')
  if (('listing_id' in body && !positive(body.listing_id)) || ('conversation_id' in body && !positive(body.conversation_id))) invalid('Invalid message target.')
  const kind = body.kind ?? 'message'
  if (!['message','offer'].includes(kind)) invalid('Invalid message kind.')
  // Message.cs trims text before applying its 1000-character limit.
  if (body.text !== undefined && typeof body.text !== 'string') invalid('Message text must be text.')
  const text = body.text?.trim()
  if (text !== undefined && text.length > 1000) invalid('Message is too long (max 1000 characters).')
  if (kind === 'message' && !text) invalid('Write a message first.')
  if (kind === 'offer' && (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0 || body.amount > 1000000)) invalid('Offer must be greater than zero and at most 1000000.')
  if (kind === 'message' && body.amount !== undefined) invalid('Amounts are for offers only.')
  return { ...body, ...(text !== undefined ? { text } : {}), kind }
}
export function messageResponse(data, kind) {
  function project(v, schema) {
    if (!v || typeof v !== 'object') invalid('Invalid messaging response.',502)
    const out = {}
    for (const [key,type] of Object.entries(schema)) {
      const val = v[key]
      if (!(type === 'id' ? positive(val) : type === 'count' ? Number.isSafeInteger(val) && val >= 0 : type === 'nullableNumber' ? val === null || typeof val === 'number' && Number.isFinite(val) : type === 'nullableString' ? val === null || typeof val === 'string' : typeof val === type)) invalid('Invalid messaging response.',502)
      out[key] = val
    }
    return out
  }
  if (kind === 'sent') return project(data,{conversation_id:'id'})
  if (kind === 'unread') return project(data,{unread:'count'})
  if (kind === 'conversations') {
    if (!Array.isArray(data)) invalid('Invalid conversations.',502)
    return data.map(v => project(v,{id:'id',listing_id:'id',listing_title:'string',role:'string',other_name:'string',last_kind:'string',last_text:'string',last_amount:'nullableNumber',last_datetime:'string',last_from_me:'boolean',unread:'count'}))
  }
  if (!positive(data?.conversation_id) || !Array.isArray(data.messages)) invalid('Invalid conversation.',502)
  return { conversation_id:data.conversation_id,messages:data.messages.map(v => project(v,{id:'id',mine:'boolean',kind:'string',text:'nullableString',amount:'nullableNumber',datetime:'string',read:'boolean'})) }
}
