import commands from './commands'
import dinkdonk from './dinkdonk'
import emote from './emote'
import coinflip from './games/coinflip'
import hangman from './games/hangman'
import roll from './games/roll'
import rps from './games/rps'
import help from './help'
import invite from './invite'
import kick from './kick'
import multistream from './multistream'
import randomemote from './randomemote'
import stealEmote from './stealEmote'
import time from './time'
import timestamp from './timestamp'
import twitch from './twitch'
import twitchClips from './twitchClips'
import weather from './weather'

export const COMMANDS: Array<DiscordAPIApplicationCommand> = [
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
  hangman,
  commands,
  multistream,
]

export const COMMAND_DEFINITIONS = COMMANDS.filter(c => c && c.command).map(c => c.command)
