import { cachedFunction } from '@/utils/cache'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const KICK_V2_USER_AGENT
  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/151.0.7422.201 Safari/537.36'

export class KickV2ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'KickV2ApiError'
    this.status = status
    this.body = body
  }
}

interface StoredCookie {
  value: string
  expiresAt: number // epoch ms
}

type CookieJar = Record<string, StoredCookie>

function cookieJarKey(hostname: string) {
  return `kick:cookies:${hostname}`
}

/** Default TTL for cookies with no Max-Age/Expires (session cookies) — kept short since they're not meant to persist. */
const DEFAULT_COOKIE_TTL_MS = 30 * 60 * 1000

function parseSetCookie(setCookieStr: string): { name: string, cookie: StoredCookie } | null {
  const parts = setCookieStr.split(';').map(p => p.trim())
  const nameValue = parts[0]
  const eqIdx = nameValue.indexOf('=')
  if (eqIdx === -1)
    return null

  const name = nameValue.slice(0, eqIdx)
  const value = nameValue.slice(eqIdx + 1)

  let expiresAt: number | undefined
  let maxAgeExpiresAt: number | undefined

  for (const attr of parts.slice(1)) {
    const attrEqIdx = attr.indexOf('=')
    if (attrEqIdx === -1)
      continue
    const attrName = attr.slice(0, attrEqIdx).toLowerCase()
    const attrValue = attr.slice(attrEqIdx + 1)

    if (attrName === 'max-age') {
      const seconds = Number(attrValue)
      if (!Number.isNaN(seconds))
        maxAgeExpiresAt = Date.now() + seconds * 1000
    }
    else if (attrName === 'expires') {
      const parsed = Date.parse(attrValue)
      if (!Number.isNaN(parsed))
        expiresAt = parsed
    }
  }

  // Max-Age takes precedence over Expires per spec when both are present.
  const resolvedExpiresAt = maxAgeExpiresAt ?? expiresAt ?? (Date.now() + DEFAULT_COOKIE_TTL_MS)

  return { name, cookie: { value, expiresAt: resolvedExpiresAt } }
}

/** Reads Set-Cookie header(s) off a Response. Handles runtimes that expose multiple Set-Cookie headers via getSetCookie() as well as ones that only expose a single combined header. */
function extractSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }
  const single = response.headers.get('set-cookie')
  return single ? [single] : []
}

async function loadCookieJar(env: Env, hostname: string): Promise<CookieJar> {
  try {
    const raw = await env.KV.get(cookieJarKey(hostname), { type: 'json' }) as CookieJar | null
    if (!raw)
      return {}

    const now = Date.now()
    const fresh: CookieJar = {}
    for (const [name, cookie] of Object.entries(raw)) {
      if (cookie.expiresAt > now)
        fresh[name] = cookie
    }
    return fresh
  }
  catch {
    return {}
  }
}

async function saveCookieJar(env: Env, hostname: string, jar: CookieJar) {
  const entries = Object.entries(jar)
  if (entries.length === 0) {
    await env.KV.delete(cookieJarKey(hostname)).catch(() => {})
    return
  }

  const maxExpiresAt = Math.max(...entries.map(([, cookie]) => cookie.expiresAt))
  const ttlSeconds = Math.max(60, Math.ceil((maxExpiresAt - Date.now()) / 1000))
  await env.KV.put(cookieJarKey(hostname), JSON.stringify(jar), { expirationTtl: ttlSeconds })
}

function buildCookieHeader(jar: CookieJar): string | undefined {
  const entries = Object.entries(jar)
  if (entries.length === 0)
    return undefined
  return entries.map(([name, cookie]) => `${name}=${cookie.value}`).join('; ')
}

/** Merges any Set-Cookie headers on a response into the persisted jar for that host. Runs regardless of response status — Cloudflare sets `__cf_bm` even on 429/403 challenge responses. */
async function updateCookieJarFromResponse(env: Env, hostname: string, response: Response) {
  const setCookieHeaders = extractSetCookieHeaders(response)
  if (setCookieHeaders.length === 0)
    return

  const jar = await loadCookieJar(env, hostname)
  let changed = false

  for (const setCookieStr of setCookieHeaders) {
    const parsed = parseSetCookie(setCookieStr)
    if (parsed) {
      jar[parsed.name] = parsed.cookie
      changed = true
    }
  }

  if (changed)
    await saveCookieJar(env, hostname, jar)
}

interface KickV2FetchOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  maxRetries?: number
  baseDelayMs?: number
  cache?: boolean
  cacheTtl?: number
}

export async function kickV2Fetch<T = unknown>(
  url: string,
  env: Env,
  options: KickV2FetchOptions = {},
): Promise<T | undefined> {
  const {
    method = 'GET',
    body,
    query,
    maxRetries = 5,
    baseDelayMs = 500,
    cache = method === 'GET',
    cacheTtl = 60,
  } = options

  const fullUrl = new URL(url)
  if (query) {
    // Sort keys so the resulting cache key is stable regardless of the
    // order the caller builds the query object in.
    for (const key of Object.keys(query).sort()) {
      const value = query[key]
      if (value !== undefined)
        fullUrl.searchParams.set(key, String(value))
    }
  }

  const cacheKey = `kick:v2:${method}:${fullUrl.toString()}`

  const doFetch = async (): Promise<T | undefined> => {
    let attempt = 0

    while (true) {
      const cookieJar = await loadCookieJar(env, fullUrl.hostname)
      const cookieHeader = buildCookieHeader(cookieJar)

      let response: Response
      try {
        response = await fetch(fullUrl.toString(), {
          method,
          headers: {
            'User-Agent': KICK_V2_USER_AGENT,
            'Accept': 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        })
      }
      catch (networkError) {
        if (attempt >= maxRetries) {
          console.error('Network error calling Kick v2 API:', networkError, { url: fullUrl.toString() })
          return undefined
        }
        attempt++
        await sleep(baseDelayMs * 2 ** (attempt - 1))
        continue
      }

      // Persist any cookies Cloudflare/Kick set, regardless of status —
      // __cf_bm is commonly set even on 429/403 challenge responses.
      await updateCookieJarFromResponse(env, fullUrl.hostname, response)

      if (response.ok) {
        if (response.status === 204)
          return undefined
        return await response.json() as T
      }

      // Hard WAF block — don't burn more requests retrying this.
      if (response.status === 403) {
        const responseBody = await response.clone().text().catch(() => '')
        if (responseBody.includes('security policy') || responseBody.includes('blocked')) {
          console.warn('Hard WAF block, not retrying', { url: fullUrl.toString(), body: responseBody })
          return undefined
        }
      }

      const retryable = response.status === 429 || response.status === 403 || response.status >= 500

      if (!retryable || attempt >= maxRetries) {
        const errorBody = await response.text().catch(() => undefined)
        console.error(
          `Kick v2 API error: ${response.status} ${response.statusText}`,
          { url: fullUrl.toString(), body: errorBody },
        )
        return undefined
      }

      attempt++
      const retryAfterHeader = response.headers.get('Retry-After')
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined
      const backoffMs = baseDelayMs * 2 ** (attempt - 1)
      const delay = retryAfterMs && !Number.isNaN(retryAfterMs)
        ? Math.max(retryAfterMs, backoffMs)
        : backoffMs

      console.warn(`Kick v2 API ${response.status}, retrying`, {
        body: await response.clone().text().catch(() => undefined),
        headers: Object.fromEntries(response.headers.entries()),
        url: fullUrl.toString(),
        attempt,
        maxRetries,
        delayMs: delay,
      })
      await sleep(delay)
    }
  }

  if (cache) {
    return cachedFunction(cacheKey, doFetch, env, cacheTtl)
  }
  return doFetch()
}
