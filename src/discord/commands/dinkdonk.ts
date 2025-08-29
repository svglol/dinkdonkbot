import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { DINKDONK_EMOTE } from '../../util/discordEmotes'
import { updateInteraction } from '../discord'
import { interactionLoading } from '../interactionHandler'

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
  ctx.waitUntil(updateInteraction(interaction, env, { content: `${DINKDONK_EMOTE.formatted}` }))
  return interactionLoading()
}

export default {
  command: DINKDONK_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
