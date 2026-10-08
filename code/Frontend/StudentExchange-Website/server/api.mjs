import { randomBytes } from 'node:crypto'
import http from 'node:http'
import https from 'node:https'

const SESSION_COOKIE = 'se_session'
const SESSION_LIFETIME = 12 * 60 * 60 * 1000
const MAX_BODY = 16 * 1024
const MAX_RESPONSE = 1024 * 1024
const PROFILE_FIELDS = ['email', 'first_name', 'last_name', 'school']
const EDITABLE_FIELDS = [...PROFILE_FIELDS, 'password']

// Respect managed HTTPS proxies without routing local development fixtures through them.
// Node 24 supports proxyEnv on its native agents, including requests with GET bodies.
const proxyEnv = {
  HTTP_PROXY: process.env.HTTP_PROXY,
  HTTPS_PROXY: process.env.HTTPS_PROXY,
  http_proxy: process.env.http_proxy,
  https_proxy: process.env.https_proxy,
  NO_PROXY: [
    process.env.NO_PROXY,
    process.env.no_proxy,
    'localhost',
    '127.0.0.1',
    '::1',
  ]
    .filter(Boolean)
    .join(','),
}
const httpAgent = new http.Agent({ proxyEnv })
const httpsAgent = new https.Agent({ proxyEnv })

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

async function readBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) {
    throw new ApiError(415, 'Send this request as JSON.')
  }
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY) throw new ApiError(413, 'The request is too large.')
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

/** Allow only public form fields; clients cannot replace app credentials or forwarded IPs. */
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
    PROFILE_FIELDS.some((field) => typeof value[field] !== 'string')
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
function upstream(base, route, method, body, timeoutMs) {
  const destination = new URL(route, base)
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
            reject(new ApiError(expired ? 401 : status, safeMessage))
          } else resolve(value)
        })
      },
    )
    request.on('error', fail)
    request.end(data)
  })
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
  timeoutMs = 15000,
} = {}) {
  const sessions = new Map()
  let base
  if (backend) {
    try {
      base = new URL(backend.endsWith('/') ? backend : `${backend}/`)
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
      if (
        !['http:', 'https:'].includes(base.protocol) ||
        (base.protocol === 'http:' && !local) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash
      ) {
        throw new Error()
      }
    } catch {
      throw new Error(
        'backend must be an HTTPS service URL, or an HTTP loopback URL for local development, without credentials, query, or fragment.',
      )
    }
  }

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
    const path = new URL(request.url, 'http://website.local').pathname
    const method = request.method
    const routes = {
      '/api/schools': ['GET'],
      '/api/register': ['POST'],
      '/api/login': ['POST'],
      '/api/profile': ['GET', 'PATCH'],
      '/api/logout': ['POST'],
    }
    if (!routes[path]) {
      send(response, 404, { message: 'API route not found.' })
      return
    }
    if (!routes[path].includes(method)) {
      response.setHeader('Allow', routes[path].join(', '))
      send(response, 405, { message: 'Method not allowed.' })
      return
    }
    const session = sessionFor(request)
    try {
      if (method !== 'GET') {
        // Origin is supplied by browser fetch. Host cannot be chosen by a cross-site script.
        const expectedOrigin = `${production ? 'https' : 'http'}://${request.headers.host}`
        if (request.headers.origin !== expectedOrigin)
          throw new ApiError(
            403,
            'Please submit account changes from this website.',
          )
      }
      if (path === '/api/logout' && !session) {
        setCookie(response)
        send(response, 200, { message: 'You have been logged out.' })
        return
      }
      if ((path === '/api/profile' || path === '/api/logout') && !session) {
        setCookie(response)
        throw new ApiError(401, 'Please log in to continue.')
      }
      if (!base || (path !== '/api/schools' && !appAccess?.trim())) {
        throw new ApiError(
          503,
          'Accounts are temporarily unavailable. Please try again later.',
        )
      }
      const call = (route, verb, fields) =>
        upstream(
          base,
          route,
          verb,
          fields ? { ...fields, app_access: appAccess } : undefined,
          timeoutMs,
        )
      const credentials = session ? { access_token: session.token } : {}

      if (path === '/api/schools') {
        const data = await call('Schools', 'GET')
        if (
          !Array.isArray(data?.Schools) ||
          !data.Schools.every(
            (school) => typeof school === 'string' && school.trim(),
          )
        ) {
          throw new ApiError(
            502,
            'The school list could not be loaded. Please try again.',
          )
        }
        send(response, 200, { schools: [...new Set(data.Schools)] })
      } else if (path === '/api/register') {
        const fields = formFields(await readBody(request), EDITABLE_FIELDS)
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
      const status = error instanceof ApiError ? error.status : 500
      if (status === 401 && session) {
        sessions.delete(session.id)
        setCookie(response)
      }
      send(response, status, {
        message:
          error instanceof ApiError
            ? error.message
            : 'Unable to complete this request. Please try again.',
      })
    }
  }
}
