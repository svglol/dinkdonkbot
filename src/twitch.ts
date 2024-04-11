// TODO save this to KV maybe and only update it when needed
let token: string | undefined
async function getToken(env: Env) {
  if (token !== undefined)
    return token

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
  token = data.access_token as string
  return token
}

export async function getChannelId(broadcasterLoginName: string, env: Env) {
  const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${broadcasterLoginName}`, {
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${await getToken(env)}`,
    },
  })

  const userData = await userRes.json() as TwitchUserData
  if (userData.data.length === 0)
    return null
  const broadcasterUserId = userData.data[0].id

  return broadcasterUserId as string
}

export async function subscribe(broadcasterUserId: string, env: Env) {
  const subscriptionData = {
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
  }
  const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${await getToken(env)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscriptionData),
  })

  return response.ok
}

export async function removeSubscription(broadcasterUserId, env: Env) {
  const subscriptionsRes = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${await getToken(env)}`,
    },
  })

  const subscriptions = await subscriptionsRes.json() as SubscriptionResponse
  const subscription = subscriptions.data.find(sub => sub.type === 1 && sub.condition.broadcaster_user_id === broadcasterUserId)

  if (subscription) {
    const deleteSubscriptionRes = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscription.id}`, {
      method: 'DELETE',
      headers: {
        'Client-ID': env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${await getToken(env)}`,
      },
    })
    return deleteSubscriptionRes.ok
  }
  return false
}

export async function getSubscriptions(env: Env) {
  const subscriptionsRes = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${await getToken(env)}`,
    },
  })
  const subscriptions = await subscriptionsRes.json() as SubscriptionResponse
  return subscriptions
}

export async function getStreamDetails(user: string, env: Env) {
  const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_login=${user}`, {
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${await getToken(env)}`,
    },
  })
  const streamData = await streamRes.json() as TwitchStreamResponse
  if (streamData.data.length === 0)
    return null
  const stream = streamData.data[0]
  return stream
}

export async function getStreamerDetails(user: string, env: Env) {
  const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${user}`, {
    headers: {
      'Client-ID': env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${await getToken(env)}`,
    },
  })
  const userData = await userRes.json() as TwitchUserData
  if (userData.data.length === 0)
    return null
  const streamer = userData.data[0]
  return streamer
}
