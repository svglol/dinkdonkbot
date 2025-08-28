import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { findBotCommandMarkdown, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const MULTISTREAM_COMMAND = {
  name: 'multistream',
  description: 'Multistream command has moved to /streams multistream',
}

async function handleCommand(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `\`/multistream\` command has moved to ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'link')}` }))
  return interactionEphemeralLoading()
}

export default {
  command: MULTISTREAM_COMMAND,
  handler: handleCommand,
} satisfies DiscordAPIApplicationCommand
