import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const INVITE_COMMAND = {
  name: 'invite',
  description: 'Get an invite link to add the bot to your server',
}

async function handleInviteCommand(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(updateInteraction(interaction, env, { content: `https://discord.com/application-directory/${env.DISCORD_APPLICATION_ID}` }))
  return interactionEphemeralLoading()
}

export default {
  command: INVITE_COMMAND,
  handler: handleInviteCommand,
} satisfies DiscordAPIApplicationCommand
