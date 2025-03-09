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

export async function subscribe(broadcasterUserId: string, env: Env) {
  try {
    const subscriptionsRes = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${await getToken(env)}`,
      },
    })
    if (!subscriptionsRes.ok)
      throw new Error(`Failed to fetch subscriptions: ${JSON.stringify(await subscriptionsRes.json())}`)
    // check if subscription already exists for stream.online and stream.offline
    const subscriptions = await subscriptionsRes.json() as SubscriptionResponse
    const onlineSubscription = subscriptions.data.find(sub => sub.type === 'stream.online' && sub.condition.broadcaster_user_id === broadcasterUserId)
    const offlineSubscription = subscriptions.data.find(sub => sub.type === 'stream.offline' && sub.condition.broadcaster_user_id === broadcasterUserId)
    if (onlineSubscription && offlineSubscription)
      return true

    let response = false
    // create stream.online subscription
    if (!onlineSubscription) {
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
          condition: {
            broadcaster_user_id: broadcasterUserId,
          },
          transport: {
            method: 'webhook',
            callback: `${env.WEBHOOK_URL}/twitch-eventsub`,
            secret: env.TWITCH_EVENT_SECRET,
          },
        }),
      })
      if (onlineResponse.ok)
        response = true
      else
        throw new Error(`Failed to create stream.online subscription: ${JSON.stringify(await onlineResponse.json())}`)
    }
    // create stream.offline subscription
    if (!offlineSubscription) {
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
          condition: {
            broadcaster_user_id: broadcasterUserId,
          },
          transport: {
            method: 'webhook',
            callback: `${env.WEBHOOK_URL}/twitch-eventsub`,
            secret: env.TWITCH_EVENT_SECRET,
          },
        }),
      })
      if (offlineResponse.ok)
        response = true
      else
        throw new Error(`Failed to create stream.offline subscription: ${JSON.stringify(await offlineResponse.json())}`)
    }
    return response
  }
  catch (error) {
    console.error('Error subscribing:', error)
  }
}

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

export async function getStreamDetails(user: string, env: Env) {
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
    if (streamData.data.length === 0) {
      throw new Error(JSON.stringify({
        message: 'Stream not found',
        response: responseDetails,
        body: streamData,
      }))
    }
    const stream = streamData.data[0]
    return stream
  }
  catch (error) {
    console.error('Error fetching stream details:', error)
    return null
  }
}

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
