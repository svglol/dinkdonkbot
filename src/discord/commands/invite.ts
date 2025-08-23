import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { applicationDirectory } from '@discordjs/formatters'
import { updateInteraction } from '../discord'
import { interactionLoading } from '../interactionHandler'

const INVITE_COMMAND = {
  name: 'invite',
  description: 'Get an invite link to add the bot to your server',
}

async function handleInviteCommand(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: applicationDirectory(env.DISCORD_APPLICATION_ID) }))
  return interactionLoading()
}

export default {
  command: INVITE_COMMAND,
  handler: handleInviteCommand,
} satisfies DiscordAPIApplicationCommand
