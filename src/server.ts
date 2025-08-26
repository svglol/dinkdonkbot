import { HangmanGame } from './durable/HangmanGame'
import { LiveStream } from './durable/LiveStream'
import { RPSGame } from './durable/RPSGame'
import fetch from './worker/fetch'
import scheduled from './worker/scheduled'

const server = {
  fetch: fetch.fetch,
  scheduled: scheduled.scheduled,
} satisfies ExportedHandler<Env>

export default server
export { HangmanGame, LiveStream, RPSGame }
