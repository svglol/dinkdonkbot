import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const DINKDONK_COMMAND = {
  name: 'dinkdonk',
  description: 'Get dinkdonked',
}

/**
 * Handles the /dinkdonk command.
 * @param interaction The interaction object from Discord
 * @param env The environment object containing configuration and authentication details.
 * @param ctx The context object from Cloudflare
 * @returns A promise that resolves to nothing. Updates the interaction with a dinkdonk emote.
 */
function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: '<a:DinkDonk:1357111617787002962>' }))
  return interactionEphemeralLoading()
}

export default {
  command: DINKDONK_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
