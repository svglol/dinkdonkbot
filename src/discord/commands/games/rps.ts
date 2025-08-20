import type { APIApplicationCommandInteraction, APIMessageComponentInteraction } from 'discord-api-types/v10'
import type { RPSGame } from '../../../durable/RPSGame'
import { interactionLoading } from '../../interactionHandler'
import { COMMAND_PERMISSIONS } from '../permissions'

const RPS_COMMAND = {
  name: 'rps',
  description: 'Challenge someone to a game of rock paper scissors',
  dm_permission: false,
  default_member_permissions: COMMAND_PERMISSIONS.USE_APPLICATION_COMMANDS,
  options: [
    {
      type: 6,
      name: 'opponent',
      description: 'The opponent to challenge',
      required: true,
    },
  ],
}

/**
 * Handles the /rps command.
 * @param interaction The interaction object from Discord
 * @param env The environment object containing configuration and authentication details.
 * @param ctx The context object from Cloudflare
 * @returns A promise that resolves to nothing. Updates the interaction with a coinflip emote.
 */
function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  const durableObjectId = env.RPSGAME.idFromName(interaction.id)
  const durableObject: DurableObjectStub<RPSGame> = env.RPSGAME.get(durableObjectId)
  ctx.waitUntil(durableObject.startGame(interaction))
  return interactionLoading()
}
async function handleMoveSelect(interaction: APIMessageComponentInteraction, env: Env, _ctx: ExecutionContext) {
  const durableObjectId = env.RPSGAME.idFromName(interaction.message.interaction_metadata?.id ?? '')
  const durableObject: DurableObjectStub<RPSGame> = env.RPSGAME.get(durableObjectId)
  return durableObject.playerMove(interaction)
}

async function handleRematch(interaction: APIMessageComponentInteraction, env: Env, _ctx: ExecutionContext) {
  const durableObjectId = env.RPSGAME.idFromName(interaction.message.interaction_metadata?.id ?? '')
  const durableObject: DurableObjectStub<RPSGame> = env.RPSGAME.get(durableObjectId)
  return durableObject.rematch(interaction)
}

export default {
  command: RPS_COMMAND,
  handler,
  messageComponentHandlers: { rps_move_select: handleMoveSelect, rps_rematch: handleRematch },
} satisfies DiscordAPIApplicationCommand
