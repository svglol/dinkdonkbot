import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { findBotCommandMarkdown, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const KICK_COMMAND = {
  name: 'kick',
  description: 'Kick command has moved to /stream kick',
  type: 1,
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
}

async function handleCommand(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'kick')} commands have moved to ${await findBotCommandMarkdown(env, 'stream', 'kick')}` }))
  return interactionEphemeralLoading()
}

export default {
  command: KICK_COMMAND,
  handler: handleCommand,
} satisfies DiscordAPIApplicationCommand
