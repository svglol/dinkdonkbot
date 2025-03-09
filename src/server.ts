import fetch from './worker/fetch'
import scheduled from './worker/scheduled'

const server = {
  fetch: fetch.fetch,
  scheduled: scheduled.scheduled,
} satisfies ExportedHandler<Env>

export default server
