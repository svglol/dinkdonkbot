export async function kickEventHandler(eventType: string, payload: KickLivestreamStatusUpdatedEvent, env: Env) {
  if (eventType !== 'livestream.status.updated') {
    throw new Error(`Invalid event type: ${eventType}`)
  }

  if (payload.is_live && payload.ended_at === null) {
    await streamOnline(payload, env)
  }
  else {
    await streamOffline(payload, env)
  }
}
async function streamOnline(payload: KickLivestreamStatusUpdatedEvent, env: Env) {
  // TODO handle payload
  console.warn('streamOnline', payload)
}

async function streamOffline(payload: KickLivestreamStatusUpdatedEvent, env: Env) {
  // TODO handle payload
  console.warn('streamOffline', payload)
}
