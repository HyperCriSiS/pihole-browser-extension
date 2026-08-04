const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Normalizes a user supplied Pi-hole address without discarding a reverse-proxy
 * path. Query strings and fragments are intentionally rejected from the stored
 * endpoint because they are not part of the API base URL.
 */
export const normalizePiHoleUrl = (input: string): string => {
  const value = String(input ?? '').trim()
  if (!value) {
    throw new Error('Pi-hole URL cannot be empty')
  }

  const url = new URL(value)
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(`Unsupported Pi-hole URL protocol: ${url.protocol}`)
  }

  url.username = ''
  url.password = ''
  url.search = ''
  url.hash = ''
  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/'

  return url.toString().replace(/\/$/, url.pathname === '/' ? '' : '')
}

/**
 * Resolves the Pi-hole v6 API base while retaining an optional reverse-proxy
 * prefix. A conventional trailing `/admin` is replaced with `/api`; otherwise
 * `/api` is appended unless it is already present.
 */
export const getPiHoleApiBaseUrl = (input: string): string => {
  const normalized = normalizePiHoleUrl(input)
  const url = new URL(normalized)
  const segments = url.pathname.split('/').filter(Boolean)
  const lastSegment = segments.at(-1)?.toLowerCase()

  if (lastSegment === 'admin') {
    segments[segments.length - 1] = 'api'
  } else if (lastSegment !== 'api') {
    segments.push('api')
  }

  url.pathname = `/${segments.join('/')}/`
  return url.toString()
}

export const getPiHoleEndpointKey = (input: string): string =>
  getPiHoleApiBaseUrl(input).replace(/\/$/, '')
