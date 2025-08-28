import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { findBotCommandMarkdown, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const KICK_COMMAND = {
  name: 'kick',
  description: 'Kick command has moved to /streams kick',
}

async function handleCommand(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `\`/kick\` command has moved to ${await findBotCommandMarkdown(env, 'stream', 'kick', 'add')}` }))
  return interactionEphemeralLoading()
}

export default {
  command: KICK_COMMAND,
  handler: handleCommand,
} satisfies DiscordAPIApplicationCommand
