import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { updateInteraction } from '../discord'
import { interactionLoading } from '../interactionHandler'

const COINFLIP_COMMAND = {
  name: 'coinflip',
  description: 'Flip a coin',
}

/**
 * Handles the /coinflip command.
 * @param interaction The interaction object from Discord
 * @param env The environment object containing configuration and authentication details.
 * @param ctx The context object from Cloudflare
 * @returns A promise that resolves to nothing. Updates the interaction with a coinflip emote.
 */
function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `A coin was flipped and it was ${Math.random() < 0.5 ? 'Heads' : 'Tails'} 🪙` }))
  return interactionLoading()
}

export default {
  command: COINFLIP_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
