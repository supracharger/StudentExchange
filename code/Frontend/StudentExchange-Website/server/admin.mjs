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
      manageAdmins: data.is_admin && level > 0,
      lockAdmins: data.is_admin && level >= 30,
      viewAdminLevels: data.is_admin && level >= 27,
      users: data.is_admin && level >= 10,
      schools: data.is_admin && level >= 10,
      profiles: data.is_admin && level >= 10,
      deleteUsers: data.is_admin && level >= 10,
      blocked: data.is_admin && level >= 20,
      endSessions: data.is_admin,
    },
  }
}

export function adminUsers(data, revealLevels = false) {
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
  const flag = value => value === true || value === 1 ? true : value === false || value === 0 ? false : unexpected()
  for (const key of ['isAdmin', 'locked', ...(revealLevels ? ['level'] : [])])
    if (!Array.isArray(body[key]) || body[key].length !== body.email.length) unexpected()
  return body.email.map((_, index) => {
    const isAdmin = flag(body.isAdmin[index])
    const locked = flag(body.locked[index])
    const result = { ...Object.fromEntries(keys.map(key => [key, body[key][index]])), isAdmin, locked }
    if (revealLevels) {
      const level = body.level[index]
      if (isAdmin ? !Number.isInteger(level) || level < 0 : level !== -1 && level != null) unexpected()
      result.level = isAdmin ? level : null
    }
    return result
  })
}

export function attemptRecords(data) {
  const identity = (user) => {
    if (!user || typeof user.name !== 'string' || typeof user.email !== 'string')
      unexpected()
    return { name: user.name, email: user.email }
  }
  const attempts = (row) => {
    if (!row || typeof row.expiry !== 'string' ||
      !Number.isInteger(row.count) || row.count < -1) unexpected()
    return { expiry: row.expiry, count: row.count }
  }
  if (!Array.isArray(data?.blockedUsers) || !Array.isArray(data?.blockedIPs))
    unexpected()
  return {
    blockedUsers: data.blockedUsers.map(row => ({ ...identity(row), ...attempts(row) })),
    blockedIPs: data.blockedIPs.map(row => {
      if (!row || typeof row.ip !== 'string' || !Array.isArray(row.users)) unexpected()
      return { ip: row.ip, ...attempts(row), users: row.users.map(identity) }
    }),
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


export function adminAssignment(body, method, status) {
  const allowed = method === 'DELETE' ? ['to_user'] : ['to_user', 'level', 'locked']
  if (Object.keys(body).some(key => !allowed.includes(key)))
    throw new AdminContractError(400, 'The request contains an unsupported field.')
  const fields = adminFields({ to_user: body.to_user }, ['to_user'], ['to_user'])
  if (method !== 'DELETE') {
    if (!Number.isInteger(body.level) || body.level < 0 || body.level >= status.level)
      throw new AdminContractError(400, 'Assign a nonnegative integer level below your own.')
    fields.level = body.level
    if (Object.hasOwn(body, 'locked')) {
      if (!status.permissions.lockAdmins)
        throw new AdminContractError(403, 'Changing locked status requires admin level 30.')
      if (![0, 1].includes(body.locked))
        throw new AdminContractError(400, 'Locked must be 0 or 1.')
      fields.locked = body.locked
    }
  }
  return fields
}

export function adminAssignmentResult(data, method) {
  if (typeof data?.email !== 'string' || !data.email.trim()) unexpected()
  return { email: data.email, message: method === 'POST' ? 'Admin access granted.' : method === 'PATCH' ? 'Admin access updated.' : 'Admin access removed.' }
}
