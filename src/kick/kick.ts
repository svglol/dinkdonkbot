const baseUrl = 'https://api.kick.com/public/v1'
export async function kickSubscribe(broadcasterUserId: number, env: Env) {
  const subscriptions = await getKickSubscriptions(env)
  // TODO we should check if the subscription type is correct as well
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
      url: `${env.WEBHOOK_URL}/kick-eventsub`,
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

export async function getKickPublicKey(env: Env) {
  const key = await env.KV.get('kick-public-key', { type: 'json' }) as string | null
  if (key)
    return key
  const response = await fetch(`${baseUrl}/public-key`, {
    method: 'GET',
  })

  if (response.ok) {
    const data = await response.json()
    await env.KV.put('kick-public-key', JSON.stringify(data), { expirationTtl: 60 * 60 * 24 * 7 })
    return data as string
  }
}
