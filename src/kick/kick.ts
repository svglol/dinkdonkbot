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
  const subscriptions = await getKickSubscriptions(env)
  const existingSubscription = subscriptions.data.find(sub => sub.broadcaster_user_id === broadcasterUserId)
  if (existingSubscription)
    return existingSubscription

  const response = await fetch(`${baseUrl}/events/subscriptions`, {
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

  if (response.status === 401)
    throw new Error('Unauthorized')
  if (response.status === 403)
    throw new Error('Forbidden')
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(error)}`)
  }

  return await response.json()
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

  const subscriptionID = subscriptions.data.find(sub => sub.broadcaster_user_id === broadcasterUserId)?.id
  if (!subscriptionID)
    return

  const response = await fetch(`${baseUrl}/events/subscriptions?id=${subscriptionID}`, {
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

  return response.status === 204
}

/**
 * Fetches all current Kick webhooks for the given environment variables.
 * @param env The environment variables to use for fetching the access token.
 * @returns A promise that resolves to a KickWebhooksResponse object containing the list of webhooks.
 * @throws If the request to fetch the webhooks fails.
 */
export async function getKickSubscriptions(env: Env) {
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

  return await response.json() as KickWebhooksResponse
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
  const response = await fetch(`${baseUrl}/channels?slug=${channel}`, {
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
  return channels.data.find(c => c.slug === channel)
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
    console.error('Error fetching access token:', error)
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
    const response = await fetch(`https://kick.com/api/v2/channels/${slug}`, {
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
      throw new Error('Forbidden')
    if (!response.ok)
      throw new Error(`HTTP error! status: ${response.status}`)

    const channels = await response.json() as KickChannelV2
    return channels
  }
  catch (error) {
    console.error('Error fetching kick v2 channel:', error)
    return undefined
  }
}
