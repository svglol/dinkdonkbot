/**
 * Gets a Twitch access token from the KV store or fetches it if it is not
 * available.  The token is stored in the KV store with a TTL equal to the
 * `expires_in` value in the response from the Twitch API.
 * @param env The environment variables to use
 * @returns The access token as a string
 * @throws If the token cannot be fetched or stored
 */
async function getToken(env: Env) {
  const token = await env.KV.get('twitch-token', { type: 'json' }) as TwitchToken | null
  if (token)
    return token.access_token
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: `client_id=${env.TWITCH_CLIENT_ID}&client_secret=${env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
    if (!res.ok)
      throw new Error(`Failed to fetch access token: ${JSON.stringify(await res.json())}`)

    const data = await res.json() as TwitchToken
    await env.KV.put('twitch-token', JSON.stringify({ ...data }), { expirationTtl: data.expires_in })
    return data.access_token as string
  }
  catch (error) {
    console.error('Error fetching access token:', error)
  }
}

/**
 * Fetches the channel id for a given broadcaster login name.
 * @param broadcasterLoginName The login name of the broadcaster
 * @param env The environment variables to use
 * @returns The channel id as a string, or null if the user is not found
 * @throws If the request fails
 */
export async function getChannelId(broadcasterLoginName: string, env: Env) {
  try {
    const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${broadcasterLoginName}`, {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${await getToken(env)}`,
      },
    })

    if (!userRes.ok)
      throw new Error(`Failed to fetch user: ${JSON.stringify(await userRes.json())}`)

    const userData = await userRes.json() as TwitchUserData
    if (userData.data.length === 0)
      return null
    const broadcasterUserId = userData.data[0].id

    return broadcasterUserId as string
  }
  catch (error) {
    console.error('Error fetching channel id:', error)
  }
}

/**
 * Subscribes to Twitch EventSub notifications for stream online and offline events
 * for a specific broadcaster. If the subscriptions already exist, the function
 * returns immediately. Otherwise, it creates the necessary subscriptions.
 *
 * @param broadcasterUserId - The Twitch user ID of the broadcaster to subscribe to.
 * @param env - The environment variables containing configuration such as client ID,
 *              webhook URL, and secrets.
 * @returns A promise that resolves to true if the subscriptions were created or already
 *          exist, and false if an error occurs during the subscription process.
 * @throws If the fetch requests to Twitch API fail.
 */
export async function subscribe(broadcasterUserId: string, env: Env) {
  try {
    const subscriptions = await getSubscriptions(env)
    if (!subscriptions)
      throw new Error('Failed to fetch subscriptions')

    const onlineSubscription = subscriptions.data.find(sub => sub.type === 'stream.online' && sub.condition.broadcaster_user_id === broadcasterUserId)
    const offlineSubscription = subscriptions.data.find(sub => sub.type === 'stream.offline' && sub.condition.broadcaster_user_id === broadcasterUserId)

    // if already subscribed to both, no need to continue
    if (onlineSubscription && offlineSubscription)
      return true

    let success = false

    // create stream.online subscription if missing
    if (!onlineSubscription) {
      try {
        const onlineResponse = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
          method: 'POST',
          headers: {
            'Client-ID': env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${await getToken(env)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'stream.online',
            version: '1',
            condition: { broadcaster_user_id: broadcasterUserId },
            transport: {
              method: 'webhook',
              callback: `${env.WEBHOOK_URL}/twitch-eventsub`,
              secret: env.TWITCH_EVENT_SECRET,
            },
          }),
        })

        if (onlineResponse.ok) {
          success = true
        }
        else {
          console.error('Failed to create stream.online subscription:', await onlineResponse.json())
        }
      }
      catch (err) {
        console.error('Error creating stream.online subscription:', err)
      }
    }

    // create stream.offline subscription if missing
    if (!offlineSubscription) {
      try {
        const offlineResponse = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
          method: 'POST',
          headers: {
            'Client-ID': env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${await getToken(env)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'stream.offline',
            version: '1',
            condition: { broadcaster_user_id: broadcasterUserId },
            transport: {
              method: 'webhook',
              callback: `${env.WEBHOOK_URL}/twitch-eventsub`,
              secret: env.TWITCH_EVENT_SECRET,
            },
          }),
        })

        if (offlineResponse.ok) {
          success = true
        }
        else {
          console.error('Failed to create stream.offline subscription:', await offlineResponse.json())
        }
      }
      catch (err) {
        console.error('Error creating stream.offline subscription:', err)
      }
    }

    return success
  }
  catch (error) {
    console.error('Error subscribing:', error)
    return false
  }
}

/**
 * Unsubscribes the Twitch EventSub subscriptions for a given broadcaster's
 * online and offline events.
 *
 * @param broadcasterUserId The ID of the Twitch broadcaster to unsubscribe
 * from.
 * @param env The environment variables for accessing configuration and services.
 * @returns A promise that resolves to true if the subscriptions were successfully
 * deleted, or false if there was an error.
 */
export async function removeSubscription(broadcasterUserId: string, env: Env) {
  try {
    const subscriptionsRes = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${await getToken(env)}`,
      },
    })
    if (!subscriptionsRes.ok)
      throw new Error(`Failed to fetch subscriptions: ${JSON.stringify(await subscriptionsRes.json())}`)

    const subscriptions = await subscriptionsRes.json() as SubscriptionResponse
    const subscriptionsToDelete = subscriptions.data.filter(sub => (sub.type === 'stream.online' || sub.type === 'stream.offline') && sub.condition.broadcaster_user_id === broadcasterUserId)
    const promises = subscriptionsToDelete.map(async (sub) => {
      try {
        const res = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.id}`, {
          method: 'DELETE',
          headers: {
            'Client-ID': env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${await getToken(env)}`,
          },
        })
        if (!res.ok)
          throw new Error(`Failed to delete subscription: ${JSON.stringify(await res.json())}`)

        return res
      }
      catch (error) {
        console.error('Error deleting subscription:', error)
      }
    })
    await Promise.allSettled(promises)
    return true
  }
  catch (error) {
    console.error('Error unsubscribing:', error)
  }
}

/**
 * Fetches all current Twitch EventSub subscriptions.
 *
 * @param env - The environment variables containing configuration such as client ID
 *              and secrets.
 * @returns A promise that resolves to a SubscriptionResponse object containing
 *          the list of subscriptions.
 * @throws If the request to fetch subscriptions fails.
 */

export async function getSubscriptions(env: Env) {
  try {
    const subscriptionsRes = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${await getToken(env)}`,
      },
    })
    if (!subscriptionsRes.ok)
      throw new Error(`Failed to fetch subscriptions: ${JSON.stringify(await subscriptionsRes.json())}`)
    const subscriptions = await subscriptionsRes.json() as SubscriptionResponse
    return subscriptions
  }
  catch (error) {
    console.error('Error fetching subscriptions:', error)
  }
}

/**
 * Fetches the stream details for a given user with retry functionality.
 *
 * @param user - The username of the streamer to fetch.
 * @param env - The environment variables containing configuration such as client ID
 *              and secrets.
 * @param maxRetries - The maximum number of retry attempts if the stream is not found.
 * @param baseDelay - The base delay in milliseconds between retries, which is used for
 *                    exponential backoff.
 * @returns A promise that resolves to a TwitchStream object containing the stream
 *          details, or null if the stream was not found or an error occurred.
 * @throws If the request to fetch the stream fails and is not retried.
 */
export async function getStreamDetails(user: string, env: Env, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_login=${user}`, {
        headers: {
          'Client-ID': env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${await getToken(env)}`,
        },
      })

      const responseDetails = {
        ok: streamRes.ok,
        status: streamRes.status,
        statusText: streamRes.statusText,
        headers: Object.fromEntries(streamRes.headers.entries()),
        url: streamRes.url,
      }

      if (!streamRes.ok) {
        const errorBody = await streamRes.text()
        throw new Error(JSON.stringify({
          message: 'Failed to fetch stream',
          response: responseDetails,
          body: errorBody,
        }))
      }

      const streamData = await streamRes.json() as TwitchStreamResponse

      if (streamData.data.length === 0 && attempt < maxRetries) {
        const delay = baseDelay * (2 ** attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      if (streamData.data.length === 0) {
        return null
      }

      const stream = streamData.data[0]
      return stream
    }
    catch (error: any) {
      console.error(`Attempt ${attempt + 1} failed for user ${user}:`, error)

      if (attempt === maxRetries) {
        console.error('Max retries reached, returning null')
        return null
      }

      // For non-final attempts, add exponential backoff delay
      const delay = baseDelay * (2 ** attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return null
}

/**
 * Fetches the streamer details for a given user.
 *
 * @param user - The username of the streamer to fetch.
 * @param env - The environment variables containing configuration such as client ID
 *              and secrets.
 * @returns A promise that resolves to a TwitchUser object containing the streamer
 *          details, or null if the streamer was not found.
 * @throws If the request to fetch the streamer fails.
 */
export async function getStreamerDetails(user: string, env: Env) {
  try {
    const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${user}`, {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${await getToken(env)}`,
      },
    })

    const responseDetails = {
      ok: userRes.ok,
      status: userRes.status,
      statusText: userRes.statusText,
      headers: Object.fromEntries(userRes.headers.entries()),
      url: userRes.url,
    }

    if (!userRes.ok) {
      const errorBody = await userRes.text()
      throw new Error(JSON.stringify({
        message: 'Failed to fetch user',
        response: responseDetails,
        body: errorBody,
      }))
    }

    const userData = await userRes.json() as TwitchUserData
    if (userData.data.length === 0) {
      throw new Error(JSON.stringify({
        message: 'User not found',
        response: responseDetails,
        body: userData,
      }))
    }
    const streamer = userData.data[0]
    return streamer
  }
  catch (error) {
    console.error('Error fetching streamer details:', error)
    return null
  }
}

/**
 * Fetches the latest Video on Demand (VOD) for a given user and stream ID.
 *
 * @param userid - The ID of the user whose VOD is to be fetched.
 * @param streamID - The ID of the stream to match with the VOD.
 * @param env - The environment variables containing configuration such as client ID
 *              and secrets.
 * @returns A promise that resolves to a VideoData object containing the VOD details,
 *          or null if no matching VOD is found.
 * @throws If the request to fetch the VOD fails.
 */

export async function getLatestVOD(userid: string, streamID: string, env: Env) {
  try {
    const vodRes = await fetch(`https://api.twitch.tv/helix/videos?user_id=${userid}&type=archive&period=week`, {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${await getToken(env)}`,
      },
    })
    if (!vodRes.ok)
      throw new Error(`Failed to fetch vod: ${JSON.stringify(await vodRes.json())}`)

    const vodData = await vodRes.json() as VideoResponseData
    if (vodData.data.length === 0)
      return null

    const vod = vodData.data.find(vod => vod.stream_id === streamID)
    return vod
  }
  catch (error) {
    console.error('Error fetching streamer details:', error)
  }
}

/**
 * Removes all failed subscriptions from the EventSub service. This is
 * typically called on a schedule, so that failed subscriptions do not
 * remain in the EventSub service indefinitely.
 *
 * @param env - The environment variables for accessing configuration and services.
 * @returns A promise that resolves when all failed subscriptions have been
 *          removed.
 */
export async function removeFailedSubscriptions(env: Env) {
  const subscriptions = await getSubscriptions(env)
  if (subscriptions) {
    const failedSubscriptions = subscriptions.data.filter(sub => sub.status !== 'enabled')
    const promises = failedSubscriptions.map(async (sub) => {
      try {
        const res = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.id}`, {
          method: 'DELETE',
          headers: {
            'Client-ID': env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${await getToken(env)}`,
          },
        })
        if (!res.ok)
          throw new Error(`Failed to delete subscription: ${JSON.stringify(await res.json())}`)
        return res
      }
      catch (error) {
        console.error('Error deleting subscription:', error)
      }
    })
    await Promise.allSettled(promises)
  }
}

/**
 * Fetches the clips for a given broadcaster ID from the last hour.
 *
 * @param broadcasterId The ID of the Twitch broadcaster to fetch clips for.
 * @param env The environment variables for accessing configuration and services.
 * @returns A promise that resolves to the TwitchClipsResponse object containing
 *          the clips, or null if the request fails.
 * @throws If the request to fetch the clips fails.
 */
export async function getClipsLastHour(broadcasterId: string, env: Env) {
  try {
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)
    const clipsRes = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&first=100&started_at=${oneHourAgo.toISOString()}`, {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${await getToken(env)}`,
      },
    })
    if (!clipsRes.ok)
      throw new Error(`Failed to fetch clips: ${JSON.stringify(await clipsRes.json())}`)
    const clips = await clipsRes.json() as TwitchClipsResponse
    return clips
  }
  catch (error) {
    console.error('Error fetching clips:', error)
  }
}

export async function getUserbyID(userId: string, env: Env) {
  try {
    const userRes = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${await getToken(env)}`,
      },
    })
    if (!userRes.ok)
      throw new Error(`Failed to fetch user: ${JSON.stringify(await userRes.json())}`)
    const userData = await userRes.json() as TwitchUserData
    if (userData.data.length === 0)
      return null
    return userData.data[0]
  }
  catch (error) {
    console.error('Error fetching user by ID:', error)
  }
}

export async function searchStreamers(query: string, env: Env, limit = 25) {
  if (!query || query.length === 0)
    return []
  try {
    const res = await fetch(`https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query)}&first=${limit}`, {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${await getToken(env)}`,
      },
    })

    if (!res.ok) {
      throw new Error(`Failed to search streamers: ${JSON.stringify(await res.json())}`)
    }

    const data = await res.json() as { data: Array<{ id: string, display_name: string }> }

    return data.data
  }
  catch (error) {
    console.error('Error searching streamers:', error)
    return []
  }
}
