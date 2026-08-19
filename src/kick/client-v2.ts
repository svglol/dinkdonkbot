import { cachedFunction } from '@/utils/cache'

const KICK_V2_MIN_INTERVAL_MS = 750
const RATE_LIMIT_KEY = 'kick:v2:last_request_at'

async function waitForKickV2RateLimit(env: Env, minIntervalMs = KICK_V2_MIN_INTERVAL_MS) {
  const last = await env.KV.get(RATE_LIMIT_KEY)
  const lastTs = last ? Number(last) : 0
  const now = Date.now()
  const elapsed = now - lastTs
  const wait = minIntervalMs - elapsed

  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait))
  }

  await env.KV.put(RATE_LIMIT_KEY, String(Date.now()), { expirationTtl: 60 })
}

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
      await waitForKickV2RateLimit(env)

      let response: Response
      try {
        response = await fetch(fullUrl.toString(), {
          method,
          headers: {
            'User-Agent': KICK_V2_USER_AGENT,
            'Accept': 'application/json',
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
        headers: response.headers,
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
