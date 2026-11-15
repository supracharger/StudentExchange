import { MOCK_POLICY, validateBackend, destinationFor } from './backend-policy.mjs'
import { imageResponse } from './images.mjs'
import { listingFields, messageFields, messageResponse } from './mobile-contracts.mjs'
import { marketplaceRoute, marketplaceResponse } from './marketplace.mjs'
import { randomBytes } from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import {
  adminStatus,
  adminUsers,
  attemptRecords,
  adminFields,
  actionResult,
  schoolFields,
  schoolDirectory,
  schoolAction,
  adminAssignment,
  adminAssignmentResult,
} from './admin.mjs'

// Azure cold starts can take two minutes; leave headroom at every upstream entry point.
const UPSTREAM_TIMEOUT_MS = 180000
const SESSION_COOKIE = 'se_session'
const SESSION_LIFETIME = 12 * 60 * 60 * 1000
const MAX_BODY = 16 * 1024
const MAX_RESPONSE = 1024 * 1024
const PROFILE_FIELDS = ['email', 'first_name', 'last_name', 'school', 'user', 'location']
const EDITABLE_FIELDS = [...PROFILE_FIELDS, 'password']
// Register POST generates the username and rejects user/location; PATCH permits both.
const REGISTRATION_FIELDS = ['email', 'first_name', 'last_name', 'school', 'password']

// Explicit agents keep credentials out of environment-configured HTTP proxies.
const httpAgent = new http.Agent({ keepAlive:false })
const httpsAgent = new https.Agent({ keepAlive:false })

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** Send only safe JSON. Account responses must never be cached by a shared CDN. */
function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

async function readBody(request, limit = MAX_BODY) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'Send this request as JSON.')
  }
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new ApiError(413, 'The request is too large.')
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error()
    return value
  } catch {
    throw new ApiError(400, 'Send a valid JSON object.')
  }
}

/** Allow only public form fields; clients cannot replace server credentials. */
function formFields(body, allowed, required = allowed) {
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new ApiError(400, 'The request contains an unsupported field.')
  }
  const result = {}
  for (const field of allowed) {
    if (body[field] != null && typeof body[field] !== 'string') {
      throw new ApiError(400, 'Account fields must be text.')
    }
    const value = body[field]?.trim()
    // PATCH deliberately omits blank fields, matching the backend's partial-update contract.
    if (value) result[field] = value
    else if (required.includes(field))
      throw new ApiError(400, 'Complete all required fields.')
  }
  if (Object.keys(result).length === 0)
    throw new ApiError(400, 'Choose at least one field to update.')
  return result
}

function publicProfile(value) {
  if (
    !value ||
    PROFILE_FIELDS.some((field) => field === 'location' ? value[field] !== null && typeof value[field] !== 'string' : typeof value[field] !== 'string')
  ) {
    throw new ApiError(
      502,
      'The account service returned an unexpected profile. Please try again.',
    )
  }
  // Explicit projection prevents future backend properties (including passwords) reaching the UI.
  return Object.fromEntries(
    PROFILE_FIELDS.map((field) => [field, value[field]]),
  )
}

/** Node's HTTP client supports the API's GET body; browser fetch and Node fetch do not. */
export function upstream(base, route, method, body, timeoutMs = UPSTREAM_TIMEOUT_MS, trafficPolicy = MOCK_POLICY) {
  if (body && ['ip', 'admin_token'].some(key => Object.hasOwn(body, key)))
    throw new ApiError(400, 'Forwarding fields are forbidden.')
  const destination = destinationFor(base, route, trafficPolicy)
  const data = body ? JSON.stringify(body) : undefined
  const signal = AbortSignal.timeout(timeoutMs)
  return new Promise((resolve, reject) => {
    // A deadline can expire before headers or while reading the body; both are gateway timeouts.
    const fail = (error) =>
      reject(
        error instanceof ApiError
          ? error
          : new ApiError(
              signal.aborted ? 504 : 502,
              signal.aborted
                ? 'The account service took too long to respond. Please try again.'
                : 'Unable to reach the account service. Please try again.',
            ),
      )
    const transport = destination.protocol === 'https:' ? https : http
    const request = transport.request(
      destination,
      {
        method,
        agent: destination.protocol === 'https:' ? httpsAgent : httpAgent,
        signal,
        headers: {
          Accept: 'application/json',
          ...(data
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
              }
            : {}),
        },
      },
      (response) => {
        const chunks = []
        let size = 0
        response.on('data', (chunk) => {
          size += chunk.length
          if (size > MAX_RESPONSE) {
            request.destroy(
              new ApiError(502, 'The account service response was too large.'),
            )
          } else chunks.push(chunk)
        })
        response.on('error', fail)
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let value
          try {
            value = JSON.parse(text)
          } catch {
            value = text
          }
          const status = response.statusCode ?? 502
          // Do not follow redirects: app credentials must stay on the configured destination.
          if (status >= 300 && status < 400) {
            reject(
              new ApiError(
                502,
                'The account service is temporarily unavailable. Please try again.',
              ),
            )
          } else if (status >= 500) {
            // The documented API may include full exceptions in 500 responses; never expose them.
            reject(
              new ApiError(
                502,
                'The account service is temporarily unavailable. Please try again.',
              ),
            )
          } else if (status >= 400) {
            const message =
              typeof value === 'string'
                ? value
                : (value?.message ?? value?.title)
            let safeMessage =
              typeof message === 'string' && message.trim()
                ? message
                : 'The account service could not complete this request.'
            // Preserve useful validation/conflict messages without echoing submitted credentials.
            for (const key of [
              'app_access',
              'access_token',
              'password',
              'admin_token',
            ]) {
              if (body?.[key])
                safeMessage = safeMessage.split(body[key]).join('[redacted]')
            }
            safeMessage = safeMessage.slice(0, 400)
            // The API uses 400 for expired/unknown tokens. Translate those to session expiry only.
            const expired =
              body?.access_token &&
              /(?:token.*(?:expired|invalid|unknown|not found|not valid)|(?:expired|invalid|unknown|not found|not valid).*token)/i.test(
                safeMessage,
              )
            const error = new ApiError(expired ? 401 : status, safeMessage)
            error.sessionExpired = Boolean(expired)
            reject(error)
          } else resolve(value)
        })
      },
    )
    request.on('error', fail)
    request.end(data)
  })
}

/** Validate the fixed destination before sending server credentials. */
export function backendUrl(backend, trafficPolicy = MOCK_POLICY) {
  return validateBackend(backend, trafficPolicy)
}

/** Application authentication stays on the adapter. Never forward client IPs or admin tokens. */
export function createApplicationClient({ backend, appAccess, timeoutMs = UPSTREAM_TIMEOUT_MS, trafficPolicy = MOCK_POLICY }) {
  const base = backendUrl(backend, trafficPolicy)
  return {
    async call(route, method, fields = {}, remainingMs = timeoutMs) {
      if (!base || !appAccess?.trim())
        throw new ApiError(503, 'Accounts are temporarily unavailable. Please try again later.')
      if (['ip', 'admin_token', 'app_access'].some(key => Object.hasOwn(fields, key)))
        throw new ApiError(400, 'The request contains an unsupported authentication field.')
      return upstream(base, route, method, { ...fields, app_access: appAccess }, Math.min(timeoutMs, remainingMs), trafficPolicy)
    },
  }
}

/**
 * Same-origin adapter for the documented ASP.NET API.
 * Tokens stay in memory on this server; the browser receives only an opaque HttpOnly cookie.
 * A restart logs users out. Use a shared session store before running multiple instances.
 */
export function createApiHandler({
  backend,
  appAccess,
  production = false,
  publicOrigin,
  apiOnly = false,
  trafficPolicy = MOCK_POLICY,
  timeoutMs = UPSTREAM_TIMEOUT_MS,
} = {}) {
  const sessions = new Map()
  const base = backendUrl(backend, trafficPolicy)
  const service = createApplicationClient({ backend, appAccess, timeoutMs, trafficPolicy })

  function setCookie(response, id = '', lifetime = 0) {
    response.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${id}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${lifetime}${production ? '; Secure' : ''}`,
    )
  }

  function sessionFor(request) {
    const id = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1)
    const session = id && sessions.get(id)
    if (session && session.expires > Date.now()) return { id, ...session }
    if (id) sessions.delete(id)
    return null
  }

  return async (request, response) => {
    const deadline = Date.now() + timeoutMs
    const path = new URL(request.url, 'http://website.local').pathname
    if (apiOnly && path.startsWith('/api/admin')) { send(response,404,{message:'API route not found.'}); return }
    const method = request.method
    const url = new URL(request.url, 'http://website.local')
    const image = /^\/api\/images\/([A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp))$/.exec(path)
    const mine = path === '/api/my-listings'
    const messaging = /^\/api\/messages(?:\/(unread|[1-9][0-9]*))?$/.exec(path)
    const market = mine ? {route:'Listing', kind:'listings', fields:()=>({for_user:''})} : marketplaceRoute(url)
    const routes = {
      '/api/schools': ['GET'],
      '/api/register': ['POST'],
      '/api/login': ['POST'],
      '/api/profile': ['GET', 'PATCH'],
      '/api/logout': ['POST'],
      '/api/admin': ['GET', 'POST', 'PATCH', 'DELETE'],
      '/api/admin/users': ['GET', 'DELETE'],
      '/api/admin/profile': ['GET', 'PATCH'],
      '/api/admin/sessions': ['DELETE'],
      '/api/admin/blocked': ['GET', 'DELETE'],
      '/api/admin/schools': ['GET', 'POST', 'DELETE'],
    }
    if (market) routes[path] = mine || market.kind === 'names' ? ['GET'] : market.kind === 'detail' ? ['GET','PATCH','DELETE'] : ['GET','POST']
    if (image) routes[path] = ['GET']
    if (messaging) routes[path] = messaging[1] ? ['GET'] : ['GET','POST']
    if (!routes[path]) {
      send(response, 404, { message: 'API route not found.' })
      return
    }
    if (!routes[path].includes(method)) {
      response.setHeader('Allow', routes[path].join(', '))
      send(response, 405, { message: 'Method not allowed.' })
      return
    }
    for (const [id, value] of sessions) if (value.expires <= Date.now()) sessions.delete(id)
    const session = sessionFor(request)
    try {
      if (method !== 'GET' || production && publicOrigin) {
        // The deployed API also protects GETs that mark messages/activity as read.
        // Origin is supplied by browser fetch. Host cannot be chosen by a cross-site script.
        const expectedOrigin = publicOrigin || `${production ? 'https' : 'http'}://${request.headers.host}`
        if (request.headers.origin !== expectedOrigin)
          throw new ApiError(
            403,
            'Use the configured application origin for API requests.',
          )
      }
      if (path === '/api/logout' && !session) {
        setCookie(response)
        send(response, 200, { message: 'You have been logged out.' })
        return
      }
      if (
        (mine || messaging || (market && method !== 'GET') || path === '/api/profile' ||
          path === '/api/logout' ||
          path.startsWith('/api/admin')) &&
        !session
      ) {
        setCookie(response)
        throw new ApiError(401, 'Please log in to continue.')
      }
      if (
        !base ||
        !appAccess?.trim()
      ) {
        throw new ApiError(
          503,
          'Accounts are temporarily unavailable. Please try again later.',
        )
      }
      // GET bodies are sent by Node; Android never receives application credentials.
      const call = (route, verb, fields) => {
        const remainingMs = deadline - Date.now()
        if (remainingMs <= 0) throw new ApiError(504, 'The backend request deadline was exceeded.')
        return service.call(route, verb, fields, remainingMs)
      }
      const credentials = session ? { access_token: session.token } : {}

      if (image) {
        if (url.search) throw new ApiError(400, 'Invalid image query.')
        await imageResponse(base, image[1], response, trafficPolicy, timeoutMs)
      } else if (market) {
        if (mine && url.search) throw new ApiError(400, 'Unsupported listing filter.')
        if (method === 'GET') {
          const fields = market.fields()
          const data = await call(market.route, 'GET', { ...fields, ...(mine || market.kind === 'detail' ? credentials : {}) })
          send(response, 200, marketplaceResponse(market.kind, data))
        } else {
          if (url.search) throw new ApiError(400, 'Unsupported listing filter.')
          const fields = method === 'DELETE' ? {id:Number(path.split('/').pop())} : listingFields(await readBody(request, 23*1024*1024), method === 'PATCH')
          let result
          try {
            result = await call(method === 'DELETE' ? 'Listing' : market.route, method, {...fields,...credentials})
          } catch (error) {
            // Listing ownership/status denials use 401 without invalidating the user's token.
            if (error.status === 401 && !error.sessionExpired)
              throw new ApiError(403, 'You do not have permission to change this listing.')
            throw error
          }
          // Creation returns a message, never an ID. Refresh own listings after success.
          if (!(typeof result === 'string' || typeof result?.message === 'string')) throw new ApiError(502, 'Invalid listing action response.')
          send(response, method === 'POST' ? 201 : 200, {message: method === 'POST' ? 'Listing created.' : method === 'DELETE' ? 'Listing deleted.' : 'Listing updated.'})
        }
      } else if (messaging) {
        const suffix = messaging[1]
        if (url.search && (!suffix || suffix === 'unread' || [...url.searchParams.keys()].some(k=>k!=='after') || url.searchParams.getAll('after').length !== 1 || !/^(0|[1-9][0-9]*)$/.test(url.searchParams.get('after')) || !Number.isSafeInteger(Number(url.searchParams.get('after'))))) throw new ApiError(400, 'Invalid message cursor.')
        const fields = method === 'POST' ? messageFields(await readBody(request)) : {}
        const route = 'api/Message' + (suffix ? '/' + suffix : '') + (url.search || '')
        const data = await call(route, method, {...fields,...credentials})
        send(response, method === 'POST' ? 201 : 200, messageResponse(data, method === 'POST' ? 'sent' : !suffix ? 'conversations' : suffix === 'unread' ? 'unread' : 'messages'))
      } else if (path.startsWith('/api/admin')) {
        // Read membership afresh for every operation so a demotion takes effect immediately.
        const status = adminStatus(await call('Admin', 'GET', credentials))
        if (path === '/api/admin' && method === 'GET') {
          send(response, 200, status)
          return
        }
        const permission =
          path === '/api/admin'
            ? 'manageAdmins'
            : path === '/api/admin/schools'
            ? 'schools'
            : path === '/api/admin/blocked'
              ? 'blocked'
              : path === '/api/admin/sessions'
                ? 'endSessions'
                : path === '/api/admin/profile'
                  ? 'profiles'
                  : method === 'DELETE'
                    ? 'deleteUsers'
                    : 'users'
        if (!status.permissions[permission])
          throw new ApiError(
            403,
            'Your administrator access does not permit this action.',
          )
        const adminCall = async (route, verb, fields) => {
          try {
            return await call(route, verb, { ...fields, ...credentials })
          } catch (error) {
            // A target of equal/higher rank is forbidden, not a lost caller session.
            if (
              error instanceof ApiError &&
              error.status === 401 &&
              !error.sessionExpired
            )
              throw new ApiError(
                403,
                path === '/api/admin/schools'
                  ? 'Your administrator access does not permit this action.'
                  : 'Your administrator access does not permit this action for this user.',
              )
            throw error
          }
        }
        if (path === '/api/admin') {
          const fields = adminAssignment(await readBody(request), method, status)
          const result = await adminCall('Admin', method, fields)
          send(response, method === 'POST' ? 201 : 200, adminAssignmentResult(result, method))
        } else if (path === '/api/admin/schools') {
          if (method === 'GET') {
            send(response, 200, { schools: schoolDirectory(await adminCall('Schools', 'GET', {})) })
          } else {
            const adding = method === 'POST'
            const fields = schoolFields(await readBody(request), adding)
            const result = await adminCall('Schools', method, fields)
            send(response, adding ? 201 : 200, schoolAction(result, adding))
          }
        } else if (path === '/api/admin/users' && method === 'GET') {
          send(response, 200, {
            users: adminUsers(await adminCall('Users', 'GET', {}), status.permissions.viewAdminLevels),
          })
        } else if (path === '/api/admin/users') {
          const fields = adminFields(
            await readBody(request),
            ['to_user'],
            ['to_user'],
          )
          const data = await adminCall('Register', 'DELETE', fields)
          send(response, 200, actionResult(data, 'Account deleted.'))
        } else if (path === '/api/admin/profile') {
          const url = new URL(request.url, 'http://website.local')
          const selectors = Object.fromEntries(url.searchParams)
          const { email } = adminFields(selectors, ['email'], ['email'])
          if (method === 'GET') {
            send(response, 200, {
              profile: publicProfile(
                await adminCall('Register', 'GET', { to_user: email }),
              ),
            })
          } else {
            const fields = formFields(
              await readBody(request),
              EDITABLE_FIELDS,
              [],
            )
            const updated = await adminCall('Register', 'PATCH', {
              ...fields,
              to_user: email,
            })
            // Preserve write success if a follow-up read fails. Never repeat a password write.
            let profile = null
            try {
              const target =
                typeof updated?.email === 'string'
                  ? updated.email
                  : fields.email?.toLowerCase() || email
              profile = publicProfile(
                await adminCall('Register', 'GET', { to_user: target }),
              )
            } catch {
              /* The saved result still needs to reach the caller. */
            }
            send(response, 200, {
              profile,
              message: profile
                ? 'Profile updated.'
                : 'Changes saved. Reload the directory to see the latest details.',
            })
          }
        } else if (path === '/api/admin/sessions') {
          const { email } = adminFields(
            await readBody(request),
            ['email'],
            ['email'],
          )
          // DELETE /LogIn masks target/token validation failures with HTTP 200.
          // Where profile reads are permitted, verify eligibility immediately before logout.
          if (status.permissions.profiles)
            publicProfile(
              await adminCall('Register', 'GET', { to_user: email }),
            )
          await adminCall('LogIn', 'DELETE', { to_user: email })
          send(response, 200, {
            message: status.permissions.profiles
              ? 'Session sign-out requested for this user.'
              : 'Sign-out request sent. The service does not confirm whether sessions were ended.',
          })
        } else if (method === 'GET') {
          send(
            response,
            200,
            attemptRecords(await adminCall('Blocked', 'GET', {})),
          )
        } else {
          const fields = adminFields(
            await readBody(request),
            ['email', 'ip_addr'],
            [],
          )
          if (Object.keys(fields).length !== 1)
            throw new ApiError(400, 'Choose exactly one email or IP address.')
          send(
            response,
            200,
            actionResult(
              await adminCall('Blocked', 'DELETE', fields),
              'Attempt records cleared.',
            ),
          )
        }
      } else if (path === '/api/schools') {
        const data = await call('Schools', 'GET')
        // Follow the current backend schema exactly: lowercase schools is required.
        const schools = data?.schools
        if (
          !Array.isArray(schools) ||
          !schools.every(
            (school) => typeof school === 'string' && school.trim(),
          )
        ) {
          throw new ApiError(
            502,
            'The school list could not be loaded. Please try again.',
          )
        }
        send(response, 200, { schools: [...new Set(schools)] })
      } else if (path === '/api/register') {
        const fields = formFields(await readBody(request), REGISTRATION_FIELDS)
        const data = await call('Register', 'POST', fields)
        if (typeof data?.email !== 'string')
          throw new ApiError(
            502,
            'The account service returned an unexpected registration response.',
          )
        // Registration intentionally does not log in: the backend does not issue a token here.
        send(response, 201, {
          email: data.email,
          message: 'Account created. You can now log in.',
        })
      } else if (path === '/api/login') {
        const fields = formFields(await readBody(request), [
          'email',
          'password',
        ])
        const data = await call('LogIn', 'POST', fields)
        if (
          typeof data?.access_token !== 'string' ||
          !data.access_token ||
          data.access_token.length > 512
        ) {
          throw new ApiError(
            502,
            'The account service returned an unexpected login response.',
          )
        }
        const profile = publicProfile(
          await call('Register', 'GET', { access_token: data.access_token }),
        )
        for (const [id, value] of sessions)
          if (value.expires <= Date.now()) sessions.delete(id)
        if (sessions.size >= 5000)
          throw new ApiError(503, 'Accounts are busy. Please try again later.')
        // Rotate on every login, including switching accounts in the same browser.
        if (session) sessions.delete(session.id)
        const id = randomBytes(32).toString('base64url')
        sessions.set(id, {
          token: data.access_token,
          expires: Date.now() + SESSION_LIFETIME,
        })
        setCookie(response, id, SESSION_LIFETIME / 1000)
        send(response, 200, { profile })
      } else if (path === '/api/profile' && method === 'GET') {
        const profile = publicProfile(
          await call('Register', 'GET', credentials),
        )
        send(response, 200, { profile })
      } else if (path === '/api/profile') {
        const fields = formFields(await readBody(request), EDITABLE_FIELDS, [])
        await call('Register', 'PATCH', { ...fields, ...credentials })
        // PATCH returns a message, not a profile. Read back the server's normalized values.
        try {
          const profile = publicProfile(
            await call('Register', 'GET', credentials),
          )
          send(response, 200, { profile, message: 'Profile updated.' })
        } catch {
          // The write succeeded; do not encourage repeating a password update after a read failure.
          send(response, 200, {
            profile: null,
            message:
              'Changes saved. Reload your profile to see the latest details.',
          })
        }
      } else if (path === '/api/logout') {
        await call('LogIn', 'DELETE', credentials)
        // Clear every local session using that token; backend logout revokes the user's tokens.
        for (const [id, value] of sessions)
          if (value.token === session.token) sessions.delete(id)
        setCookie(response)
        send(response, 200, { message: 'You have been logged out.' })
      }
    } catch (error) {
      const status =
        error instanceof ApiError || error.name === 'AdminContractError'
          ? error.status
          : 500
      if (status === 401 && session) {
        sessions.delete(session.id)
        setCookie(response)
      }
      send(response, status, {
        message:
          error instanceof ApiError || error.name === 'AdminContractError'
            ? error.message
            : 'Unable to complete this request. Please try again.',
      })
    }
  }
}
