export interface Profile {
  email: string
  first_name: string
  last_name: string
  school: string
}
export type Registration = Profile & { password: string }
export type ProfileUpdate = Partial<Registration>

export class AccountApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'AccountApiError'
  }
}

/** The browser talks only to this site's adapter; shared credentials and tokens stay server-side. */
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
  // Includes a cold start plus service login, membership checks, and profile reads.
  timeoutMs = 300000,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs),
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new AccountApiError(
      0,
      'Unable to connect. Check your connection and try again.',
    )
  }
  let data
  try {
    data = await response.json()
  } catch {
    throw new AccountApiError(
      response.status,
      'The account service returned an unexpected response. Please try again.',
    )
  }
  if (!response.ok)
    throw new AccountApiError(
      response.status,
      data.message ?? 'Unable to complete this request.',
    )
  return data as T
}

export const accounts = {
  schools: (signal?: AbortSignal) =>
    request<{ schools: string[] }>('schools', 'GET', undefined, signal),
  profile: (signal?: AbortSignal) =>
    request<{ profile: Profile }>('profile', 'GET', undefined, signal),
  register: (fields: Registration) =>
    request<{ email: string; message: string }>('register', 'POST', fields),
  login: (email: string, password: string) =>
    request<{ profile: Profile }>('login', 'POST', { email, password }),
  update: (fields: ProfileUpdate) =>
    request<{ profile: Profile | null; message: string }>(
      'profile',
      'PATCH',
      fields,
    ),
  logout: () => request<{ message: string }>('logout', 'POST', {}),
}
