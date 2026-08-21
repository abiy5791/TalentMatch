/**
 * Where the API lives.
 *
 * Unset means same-origin: the dev server proxies /api, and in production a
 * rewrite in vercel.json forwards it to the API deployment. Keeping the browser
 * on one origin means no CORS preflight on every call and no third-party-cookie
 * question to answer later.
 *
 * Set VITE_API_URL to the API's own origin to call it directly instead — useful
 * when the two are on unrelated domains. It is baked in at build time, so
 * changing it needs a redeploy, and CORS_ORIGIN on the API has to name this
 * origin back.
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const BASE = `${API_ORIGIN}/api/v1`

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      // FormData sets its own Content-Type, boundary included.
      ...(init.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...authHeaders(),
      ...(init.headers as Record<string, string>),
    },
  })

  if (res.status === 401) {
    // Token expired or invalid — drop it and send the user back to the login screen.
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (!window.location.pathname.startsWith('/login')) window.location.href = '/login'
    throw new ApiError(401, 'Session expired, please sign in again')
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message || res.statusText
    throw new ApiError(res.status, message)
  }
  return data as T
}

function query(params?: Record<string, unknown>) {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : ''
}

/**
 * A CV download. The endpoint checks the caller, so the token has to travel
 * with the request — a plain link would arrive without one. The blob is fetched,
 * handed to the browser as a save, and the object URL revoked straight after.
 */
async function download(path: string, fallbackName: string) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) {
    const text = await res.text()
    let message = res.statusText
    try {
      message = JSON.parse(text)?.message || message
    } catch {
      /* a non-JSON error body is not worth surfacing verbatim */
    }
    throw new ApiError(res.status, message)
  }

  // The server names the file; the caller's guess is only a fallback.
  const disposition = res.headers.get('Content-Disposition') || ''
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
  const plain = /filename="([^"]+)"/i.exec(disposition)?.[1]
  const name = encoded ? decodeURIComponent(encoded) : plain || fallbackName

  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>(`${path}${query(params)}`),
  /**
   * Multipart POST. Content-Type is left unset on purpose so the browser adds
   * it with the multipart boundary; setting it by hand breaks the parse.
   */
  upload: <T>(path: string, file: File, field = 'file') => {
    const form = new FormData()
    form.append(field, file)
    return request<T>(path, { method: 'POST', body: form })
  },
  download,
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
