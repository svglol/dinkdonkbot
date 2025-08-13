import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { updateInteraction } from '../discord'
import { interactionLoading } from '../interactionHandler'

const INVITE_COMMAND = {
  name: 'invite',
  description: 'Get an invite link to add the bot to your server',
}

async function handleInviteCommand(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  const applicationId = env.DISCORD_APPLICATION_ID
  const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&permissions=8797166895104&scope=applications.commands+bot`
  const inviteMessage = `[Click here to invite the bot to your server!](${INVITE_URL})`
  ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: inviteMessage }))
  return interactionLoading()
}

export default {
  command: INVITE_COMMAND,
  handler: handleInviteCommand,
} satisfies DiscordAPIApplicationCommand
