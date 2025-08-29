import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { findBotCommandMarkdown, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const TWITCH_COMMAND = {
  name: 'twitch',
  description: 'Twitch command has moved to /streams twitch',
  type: 1,
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
}

async function handleCommand(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'twitch')} commands have moved to ${await findBotCommandMarkdown(env, 'streams', 'twitch')}` }))
  return interactionEphemeralLoading()
}

export default {
  command: TWITCH_COMMAND,
  handler: handleCommand,
} satisfies DiscordAPIApplicationCommand
