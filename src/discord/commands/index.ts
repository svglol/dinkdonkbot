import * as coinflip from './coinflip'
import * as dinkdonk from './dinkdonk'
import * as emote from './emote'
import * as help from './help'
import * as invite from './invite'
import * as kick from './kick'
import * as randomemote from './randomemote'
import * as roll from './roll'
import * as rps from './rps'
import * as stealEmote from './stealEmote'
import * as time from './time'
import * as timestamp from './timestamp'
import * as twitch from './twitch'
import * as twitchClips from './twitchClips'
import * as weather from './weather'

export const COMMANDS: Array<{ default: DiscordAPIApplicationCommand }> = [
  dinkdonk,
  invite,
  help,
  twitch,
  emote,
  kick,
  twitchClips,
  stealEmote,
  time,
  weather,
  timestamp,
  randomemote,
  coinflip,
  rps,
  roll,
]

// Registration
export const COMMAND_DEFINITIONS = COMMANDS.map(c => c.default.command)

// Handler lookup
export function findHandlerByName(name: string) {
  return COMMANDS.find(c => c.default.command.name.toLowerCase() === name.toLowerCase())?.default.handler
}

export function findModalSubmitHandlerByName(name: string) {
  return COMMANDS.map(c => c.default.modalSubmitHandlers?.[name.toLowerCase()]).find(Boolean)
}

export function findAutoCompleteHandlerByName(name: string) {
  return COMMANDS.find(c => c.default.command.name.toLowerCase() === name.toLowerCase())?.default.autoCompleteHandler
}

export function findMessageComponentHandlerByName(name: string) {
  return COMMANDS.map(c => c.default.messageComponentHandlers?.[name.toLowerCase()]).find(Boolean)
}
