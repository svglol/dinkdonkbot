import commandusage from './commandusage'
import healthcheck from './healthcheck'
import stats from './stats'

export const ADMIN_COMMANDS: Array<DiscordAPIApplicationCommand> = [
  stats,
  healthcheck,
  commandusage,
]

export const ADMIN_COMMAND_DEFINITIONS = ADMIN_COMMANDS.filter(c => c && c.command).map(c => c.command)
