const baseUrl = 'https://api.kick.com/public/v1'
/**
 * Subscribes to Kick EventSub notifications for a given broadcaster's
 * livestream status updates.
 *
 * @param broadcasterUserId The ID of the Kick broadcaster to subscribe to.
 * @param env The environment variables containing configuration such as access token,
 *            webhook URL, and secrets.
 * @returns A promise that resolves to the subscription object if the subscription
 *          was created, or the existing subscription if it already exists.
 * @throws If the request to create the subscription fails.
 */
export async function kickSubscribe(broadcasterUserId: number, env: Env) {
  try {
    const subscriptions = await getKickSubscriptions(env)
    const statusSubscription = subscriptions.data.find(sub => sub.broadcaster_user_id === broadcasterUserId && sub.event === 'livestream.status.updated')
    const metaSubscription = subscriptions.data.find(sub => sub.broadcaster_user_id === broadcasterUserId && sub.event === 'livestream.metadata.updated')
    if (statusSubscription && metaSubscription)
      return true

    let response = false
    if (!statusSubscription) {
      const statusResponse = await fetch(`${baseUrl}/events/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getKickToken(env)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'webhook',
          events: [
            {
              name: 'livestream.status.updated',
              version: 1,
            },
          ],
          broadcaster_user_id: broadcasterUserId,
        }),
      })

      if (statusResponse.status === 401)
        throw new Error('Unauthorized')
      if (statusResponse.status === 403)
        throw new Error('Forbidden')
      if (!statusResponse.ok) {
        const error = await statusResponse.json().catch(() => ({}))
        throw new Error(`HTTP error! status: ${statusResponse.status}, message: ${JSON.stringify(error)}`)
      }

      response = true
    }

    if (!metaSubscription) {
      // Create a subscription for livestream metadata updates
      const metaResponse = await fetch(`${baseUrl}/events/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getKickToken(env)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'webhook',
          events: [
            {
              name: 'livestream.metadata.updated',
              version: 1,
            },
          ],
          broadcaster_user_id: broadcasterUserId,
        }),
      })

      if (metaResponse.status === 401)
        throw new Error('Unauthorized')
      if (metaResponse.status === 403)
        throw new Error('Forbidden')
      if (!metaResponse.ok) {
        const error = await metaResponse.json().catch(() => ({}))
        throw new Error(`HTTP error! status: ${metaResponse.status}, message: ${JSON.stringify(error)}`)
      }

      response = true
    }

    return response
  }
  catch (error) {
    console.error('Error subscribing to Kick EventSub:', error, { broadcasterUserId })
    return false
  }
}

/**
 * Unsubscribes from the Kick EventSub notification for a given broadcaster.
 * @param broadcasterUserId The ID of the Twitch broadcaster to unsubscribe from.
 * @param env The environment variables to use for fetching the access token.
 * @returns A promise that resolves to true if the subscription was successfully
 *          deleted, or false if there was an error.
 * @throws If the request to delete the subscription fails.
 */
export async function kickUnsubscribe(broadcasterUserId: number, env: Env) {
  const subscriptions = await getKickSubscriptions(env)

  const filteredSubscriptions = subscriptions.data.filter(sub => sub.broadcaster_user_id === broadcasterUserId)
  if (!filteredSubscriptions || filteredSubscriptions.length === 0)
    return
  for (const sub of filteredSubscriptions) {
    try {
      const response = await fetch(`${baseUrl}/events/subscriptions?id=${sub.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${await getKickToken(env)}`,
        },
      })

      if (response.status === 401)
        throw new Error('Unauthorized')
      if (response.status === 403)
        throw new Error('Forbidden')
      if (!response.ok && response.status !== 204) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    }
    catch (error: unknown) {
      console.error(`Error unsubscribing from Kick EventSub for broadcaster:`, error, { broadcasterUserId })
    }
  }
}

/**
 * Fetches all current Kick webhooks for the given environment variables.
 * @param env The environment variables to use for fetching the access token.
 * @returns A promise that resolves to a KickWebhooksResponse object containing the list of webhooks.
 * @throws If the request to fetch the webhooks fails.
 */
export async function getKickSubscriptions(env: Env) {
  try {
    const cacheKey = `kick_subscriptions_${env.KICK_CLIENT_ID}`
    const cachedSubscriptions = await env.KV.get(cacheKey, { type: 'json' }) as KickWebhooksResponse | null
    if (cachedSubscriptions) {
      return cachedSubscriptions
    }

    const response = await fetch(`${baseUrl}/events/subscriptions`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${await getKickToken(env)}`,
      },
    })

    if (response.status === 401)
      throw new Error('Unauthorized')
    if (response.status === 403)
      throw new Error('Forbidden')
    if (!response.ok)
      throw new Error(`HTTP error! status: ${response.status}`)

    const data = await response.json() as KickWebhooksResponse
    await env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 60 })

    return data
  }
  catch (error) {
    console.error('Error fetching Kick webhooks:', error)
    return { data: [] }
  }
}

/**
 * Fetches a Kick channel by its slug.
 *
 * @param channel The slug of the channel to fetch.
 * @param env The environment variables to use for fetching the access token.
 * @returns The Kick channel object, or null if the channel could not be
 *          found.
 * @throws If the request to fetch the channel fails.
 */
export async function getKickChannel(channel: string, env: Env) {
  const response = await fetch(`${baseUrl}/channels?slug=${channel.toLowerCase().replace(/_/g, '-')}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${await getKickToken(env)}`,
    },
  })
  if (response.status === 401)
    throw new Error('Unauthorized')
  if (response.status === 403)
    throw new Error('Forbidden')
  if (!response.ok)
    throw new Error(`HTTP error! status: ${response.status}`)

  const channels = await response.json() as KickChannelsResponse
  return channels.data.find(c => c.slug === channel.toLowerCase().replace(/_/g, '-'))
}

/**
 * Fetches a Kick access token from the KV store or fetches it if it is not
 * available.  The token is stored in the KV store with a TTL equal to the
 * `expires_in` value in the response from the Kick API.
 *
 * @param env The environment variables to use
 * @returns The access token as a string
 * @throws If the token cannot be fetched or stored
 */
export async function getKickToken(env: Env) {
  const token = await env.KV.get('kick-token', { type: 'json' }) as KickToken | null
  if (token)
    return token.access_token

  try {
    const res = await fetch(`https://id.kick.com/oauth/token`, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: env.KICK_CLIENT_ID,
        client_secret: env.KICK_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
    if (!res.ok)
      throw new Error(`Failed to fetch access token: ${JSON.stringify(await res.json())}`)

    const data = await res.json() as KickToken
    await env.KV.put('kick-token', JSON.stringify({ ...data }), { expirationTtl: Number(data.expires_in) })
    return data.access_token
  }
  catch (error) {
    console.error('Error fetching kick access token:', error)
  }
}

/**
 * Retrieves the Kick public key from the KV store, or fetches it from the Kick API
 * if it is not available.
 * @param env The environment variables to use
 * @returns The public key as a string
 * @throws If the public key cannot be fetched or stored
 */
export async function getKickPublicKey(env: Env) {
  const key = await env.KV.get('kick-public-key') as string | null
  if (key)
    return key
  const response = await fetch(`${baseUrl}/public-key`, {
    method: 'GET',
  })

  if (response.ok) {
    const data = await response.json() as { data: { public_key: string } }
    await env.KV.put('kick-public-key', data.data.public_key, { expirationTtl: 60 * 60 * 24 * 7 })
    return data.data.public_key
  }
}

/**
 * Fetches the user data for a given user ID.
 *
 * @param userId - The user ID to fetch.
 * @param env - The environment variables to use for fetching the access token.
 * @returns A promise that resolves to a KickUser object containing the user data, or null if the user was not found.
 * @throws If the request to fetch the user fails.
 */
export async function getKickUser(userId: number, env: Env) {
  const response = await fetch(`${baseUrl}/users?id=${userId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${await getKickToken(env)}`,
    },
  })
  if (response.status === 401)
    throw new Error('Unauthorized')
  if (response.status === 403)
    throw new Error('Forbidden')
  if (!response.ok)
    throw new Error(`HTTP error! status: ${response.status}`)

  const users = await response.json() as KickUserResponse
  return users.data.find(u => u.user_id === userId)
}

/**
 * Fetches the current live stream for a given broadcaster id.
 *
 * @param broadcasterId The id of the broadcaster to fetch the live stream for.
 * @param env The environment variables to use for fetching the access token.
 * @returns The current live stream, or null if the streamer is not live.
 * @throws If the request to fetch the stream fails.
 */
export async function getKickLivestream(broadcasterId: number, env: Env) {
  const response = await fetch(`${baseUrl}/livestreams?broadcaster_user_id=${broadcasterId}&limit=1`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${await getKickToken(env)}`,
    },
  })
  if (response.status === 401)
    throw new Error('Unauthorized')
  if (response.status === 403)
    throw new Error('Forbidden')
  if (!response.ok)
    throw new Error(`HTTP error! status: ${response.status}`)

  const streams = await response.json() as KickLiveStreamResponse
  return streams.data.find(s => s.broadcaster_user_id === broadcasterId)
}

/**
 * Fetches a Kick channel by its slug.
 * @param slug - The slug of the channel to fetch.
 * @returns A promise that resolves to a KickChannelV2 object containing the
 *          channel details, or throws an error if the channel was not found.
 * @throws If the request to fetch the channel fails.
 */
export async function getKickChannelV2(slug: string) {
  try {
    const response = await fetch(`https://kick.com/api/v2/channels/${slug.toLowerCase().replace(/_/g, '-')}`, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
          + '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    })
    if (response.status === 401)
      throw new Error('Unauthorized')
    if (response.status === 403)
      throw new Error(`Forbidden: ${{ headers: Object.fromEntries(response.headers.entries()) }}`)
    if (!response.ok)
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`)

    const channels = await response.json() as KickChannelV2
    return channels
  }
  catch (error) {
    console.error('Error fetching kick v2 channel:', error, { slug })
    return undefined
  }
}

/**
 * Fetches the latest Video on Demand (VOD) for a given Kick channel.
 *
 * @param startedAt - The start time of the Stream in ISO 8601 format.
 * @param slug - The slug of the channel to fetch the latest VOD from.
 * @returns A promise that resolves to a KickVOD object containing the VOD details,
 *          or undefined if no VOD is found or an error occurs.
 * @throws Will throw an error if the request fails due to network issues or invalid responses.
 *         Specific errors are thrown for unauthorized access, forbidden access, channel not found,
 *         rate limits, or other HTTP errors.
 */
export async function getKickLatestVod(startedAt: string, slug: string) {
  try {
    if (!slug || slug.trim() === '') {
      throw new Error('Channel slug is required')
    }

    const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug.toLowerCase().replace(/_/g, '-'))}/videos`, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
          + '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    })

    if (response.status === 401) {
      throw new Error('Unauthorized: API key may be required')
    }
    if (response.status === 403) {
      throw new Error('Forbidden: Access denied to this channel' + `: ${{ headers: Object.fromEntries(response.headers.entries()) }}`)
    }
    if (response.status === 404) {
      throw new Error(`Channel "${slug}" not found`)
    }
    if (response.status === 429) {
      throw new Error('Rate limited: Too many requests')
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const videos = await response.json() as KickVOD[]

    // Check if videos array exists and has content
    if (!Array.isArray(videos)) {
      throw new TypeError('Invalid response format: expected array of videos')
    }

    if (videos.length === 0) {
      return null
    }
    function toUTC(dateStr: string): string {
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
        return new Date(`${dateStr.replace(' ', 'T')}Z`).toISOString()
      }
      return new Date(dateStr).toISOString()
    }

    const startedTime = new Date(startedAt).getTime()
    const tolerance = 2 * 60 * 1000

    for (const video of videos) {
      const videoTime = new Date(toUTC(video.start_time)).getTime()
      if (Math.abs(videoTime - startedTime) <= tolerance) {
        return video
      }
    }
    return null
  }
  catch (error) {
    if (error instanceof Error) {
      console.error(`Error fetching latest VOD for channel:`, error.message, { startedAt, slug })
    }
    else {
      console.error(`Error fetching latest VOD for channel:`, error, { startedAt, slug })
    }
    return null
  }
}

export async function getKickStatus(env: Env) {
  const response = await fetch(`${baseUrl}/events/subscriptions`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${await getKickToken(env)}`,
    },
  })
  return response
}

export async function getKickClips(slug: string, env: Env, sort?: 'views' | 'date', time?: 'day' | 'week' | 'month' | 'all', cursor?: string) {
  try {
    const params = new URLSearchParams()
    if (sort)
      params.set('sort', sort)
    if (time)
      params.set('time', time)
    if (cursor)
      params.set('cursor', cursor)

    const url = `https://kick.com/api/v2/channels/${slug.toLowerCase().replace(/_/g, '-')}/clips${params.size ? `?${params}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('Kick clips API error:', response.status, response.statusText, { slug, sort, time })
      return undefined
    }

    const clips = await response.json() as KickClipsResponse

    if (!Array.isArray(clips?.clips)) {
      console.error('Kick clips unexpected response shape:', JSON.stringify(clips), { slug, sort, time })
      return undefined
    }

    for (const clip of clips.clips) {
      clip.clip_url = `https://kick.com/${clip.channel.slug}/clips/${clip.id}`
    }

    return clips
  }
  catch (error) {
    console.error('Error fetching kick clips:', error, { slug, sort, time, cursor })
  }
}

export async function getKickClipsLastHour(slug: string, env: Env) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const allClips: KickClip[] = []
  let cursor: string | undefined

  while (true) {
    const response = await getKickClips(slug, env, 'date', 'day', cursor)
    if (!response?.clips?.length)
      break

    const filtered = response.clips.filter(clip => new Date(clip.created_at) >= oneHourAgo)
    allClips.push(...filtered)

    // If we got fewer clips than the page or the oldest clip is already older than 1h, stop
    if (filtered.length < response.clips.length || !response.nextCursor)
      break

    cursor = response.nextCursor
  }
  return allClips.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

export async function searchKickChannels(query: string) {
  try {
    const res = await fetch('https://search.kick.com/multi_search', {
      method: 'POST',
      headers: {
        'User-Agent':
           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
           + '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'X-TYPESENSE-API-KEY': 'nXIMW0iEN6sMujFYjFuhdrSwVow3pDQu',
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: JSON.stringify({
        searches: [{ preset: 'channel_search', q: query }],
      }),
    })

    if (!res.ok)
      throw new Error(`HTTP error! status: ${res.status}`)

    const json = await res.json<KickMultiSearchResponse>()
    return json.results[0]?.hits?.map(h => h.document) ?? []
  }
  catch (error) {
    console.error('Error searching kick channels:', error, { query })
    return []
  }
}
