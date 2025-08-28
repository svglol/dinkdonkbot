import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { findBotCommandMarkdown, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const TWITCH_COMMAND = {
  name: 'twitch',
  description: 'Twitch command has moved to /streams twitch',
}

async function handleCommand(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `\`/twitch\` command has moved to ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'add')}` }))
  return interactionEphemeralLoading()
}

export default {
  command: TWITCH_COMMAND,
  handler: handleCommand,
} satisfies DiscordAPIApplicationCommand
