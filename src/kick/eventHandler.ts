export async function kickEventHandler(payload, env: Env) {
  // TODO determine what to do with paylod
  // TODO set up payload types
  console.warn('kickEventHandler', payload)
//   if (payload.event) {
//     if (payload.subscription.type === 'stream.online') {
//       await streamOnline(payload, env)
//     }
//     else if (payload.subscription.type === 'stream.offline') {
//       await streamOffline(payload, env)
//     }
//   }
}
async function streamOnline(payload, env: Env) {
  // TODO handle payload
  console.warn('streamOnline', payload)
}

async function streamOffline(payload, env: Env) {
  // TODO handle payload
  console.warn('streamOffline', payload)
}