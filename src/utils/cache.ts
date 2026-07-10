export async function cachedFunction<T>(key: string, fn: () => Promise<T>, env: Env, ttl = 60): Promise<T> {
  const cached = await env.KV.get<T>(key, { type: 'json' })
  if (cached !== null && cached !== undefined)
    return cached
  const result = await fn()
  await env.KV.put(key, JSON.stringify(result), { expirationTtl: ttl })
  return result
}
