/** Explicit projections keep credentials and future backend fields out of admin responses. */
class AdminContractError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'AdminContractError'
    this.status = status
  }
}
const unexpected = () => {
  throw new AdminContractError(
    502,
    'The administrator service returned an unexpected response. Please try again.',
  )
}

export function adminStatus(data) {
  if (
    typeof data?.is_admin !== 'boolean' ||
    (data.is_admin && !Number.isInteger(data.level))
  )
    unexpected()
  const level = data.is_admin ? data.level : null
  return {
    is_admin: data.is_admin,
    level,
    permissions: {
      users: data.is_admin && level >= 1,
      schools: data.is_admin && level >= 1,
      profiles: data.is_admin && level >= 1,
      deleteUsers: data.is_admin && level >= 1,
      blocked: data.is_admin && level >= 2,
      endSessions: data.is_admin,
    },
  }
}

export function adminUsers(data) {
  const body = data?.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) unexpected()
  if (!Object.keys(body).length) return []
  const keys = ['email', 'name', 'school', 'datetime']
  if (
    !Array.isArray(body.email) ||
    keys.some(
      (key) =>
        !Array.isArray(body[key]) ||
        body[key].length !== body.email.length ||
        body[key].some((value) => typeof value !== 'string'),
    )
  )
    unexpected()
  return body.email.map((_, index) =>
    Object.fromEntries(keys.map((key) => [key, body[key][index]])),
  )
}

export function attemptRecords(data) {
  const project = (rows, ip = false) => {
    if (!Array.isArray(rows)) unexpected()
    const keys = ['name', 'email', 'expiry', ...(ip ? ['ip'] : [])]
    return rows.map((row) => {
      if (
        !row ||
        keys.some((key) => typeof row[key] !== 'string') ||
        !Number.isInteger(row.count) ||
        row.count < 0
      )
        unexpected()
      return {
        ...Object.fromEntries(keys.map((key) => [key, row[key]])),
        count: row.count,
      }
    })
  }
  return {
    blockedUsers: project(data?.blockedUsers),
    blockedIPs: project(data?.blockedIPs, true),
  }
}

export function adminFields(body, allowed, required) {
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw new AdminContractError(
      400,
      'The request contains an unsupported field.',
    )
  const fields = {}
  for (const key of allowed) {
    // Selectors are exact backend values: never trim or lowercase them here.
    if (
      body[key] != null &&
      (typeof body[key] !== 'string' ||
        !body[key].trim() ||
        body[key].length > 254)
    )
      throw new AdminContractError(400, 'Enter a valid email or IP address.')
    if (body[key] != null) fields[key] = body[key]
    else if (required.includes(key))
      throw new AdminContractError(400, 'Complete all required fields.')
  }
  return fields
}

export function actionResult(data, message) {
  if (!data || !Number.isInteger(data.deleted_Rows) || data.deleted_Rows < 0)
    unexpected()
  return { message, deletedRows: data.deleted_Rows }
}


export function schoolFields(body, adding) {
  const allowed = ['name', 'short_name']
  if (Object.keys(body).some(key => !allowed.includes(key)))
    throw new AdminContractError(400, 'The request contains an unsupported field.')
  const fields = {}
  for (const key of allowed) {
    if (body[key] != null) {
      if (typeof body[key] !== 'string' || !body[key].trim())
        throw new AdminContractError(400, 'Enter a valid school name or short name.')
      fields[key] = body[key]
    }
  }
  if ((adding && allowed.some(key => !(key in fields))) || !Object.keys(fields).length)
    throw new AdminContractError(400, adding ? 'Enter the school name and short name.' : 'Choose a school name or short name.')
  return fields
}

export function schoolDirectory(data) {
  if (
    !Array.isArray(data?.schools) || !Array.isArray(data?.short_names) ||
    data.schools.length !== data.short_names.length ||
    [...data.schools, ...data.short_names].some(value => typeof value !== 'string' || !value.trim())
  ) unexpected()
  return data.schools.map((name, index) => ({ name, short_name: data.short_names[index] }))
}

export function schoolAction(data, adding) {
  if (!data || (adding && (typeof data.name !== 'string' || typeof data.short_name !== 'string')) ||
    (!adding && (!Number.isInteger(data.row_count) || data.row_count < 1))) unexpected()
  return adding
    ? { message: 'School added.', name: data.name, short_name: data.short_name }
    : { message: 'School deleted.', deletedRows: data.row_count }
}
