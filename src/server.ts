import { ChannelState } from './durable/ChannelState'
import { RPSGame } from './durable/RPSGame'
import fetch from './worker/fetch'
import scheduled from './worker/scheduled'

const server = {
  fetch: fetch.fetch,
  scheduled: scheduled.scheduled,
} satisfies ExportedHandler<Env>

export default server
export { ChannelState, RPSGame }
