import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { findBotCommandMarkdown, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const MULTISTREAM_COMMAND = {
  name: 'multistream',
  description: 'Multistream command has moved to /stream multistream',
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
}

async function handleCommand(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'multistream')} commands have moved to ${await findBotCommandMarkdown(env, 'stream', 'multistream')}` }))
  return interactionEphemeralLoading()
}

export default {
  command: MULTISTREAM_COMMAND,
  handler: handleCommand,
} satisfies DiscordAPIApplicationCommand
