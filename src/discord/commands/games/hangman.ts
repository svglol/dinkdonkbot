import type { APIApplicationCommandInteraction, APIMessageComponentInteraction, APIModalSubmitInteraction } from 'discord-api-types/v10'
import type { HangmanGame } from '../../../server'
import { interactionLoading } from '../../interactionHandler'
import { COMMAND_PERMISSIONS } from '../permissions'

const HANGMAN_COMMAND = {
  name: 'hangman',
  description: 'Create a community game of hangman',
  dm_permission: false,
  default_member_permissions: COMMAND_PERMISSIONS.USE_APPLICATION_COMMANDS,
  options: [
    {
      type: 3,
      name: 'word',
      description: 'Word or phrase you want to use for the game',
      min_length: 1,
      max_length: 100,
      required: false,
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
  const durableObjectId = env.HANGMANGAME.idFromName(interaction.id)
  const durableObject: DurableObjectStub<HangmanGame> = env.HANGMANGAME.get(durableObjectId)
  ctx.waitUntil(durableObject.startGame(interaction))
  return interactionLoading()
}

async function handleMakeGuess(interaction: APIMessageComponentInteraction, env: Env, _ctx: ExecutionContext) {
  const durableObjectId = env.HANGMANGAME.idFromName(interaction.message.interaction_metadata?.id ?? '')
  const durableObject: DurableObjectStub<HangmanGame> = env.HANGMANGAME.get(durableObjectId)
  return durableObject.makeGuessButton(interaction)
}

async function handleGuessModal(interaction: APIModalSubmitInteraction, env: Env, _ctx: ExecutionContext) {
  const durableObjectId = env.HANGMANGAME.idFromName(interaction.message?.interaction_metadata?.id ?? '')
  const durableObject: DurableObjectStub<HangmanGame> = env.HANGMANGAME.get(durableObjectId)
  return durableObject.guessModal(interaction)
}

export default {
  command: HANGMAN_COMMAND,
  handler,
  messageComponentHandlers: { hangman_make_guess: handleMakeGuess },
  modalSubmitHandlers: { hangman_guess_modal: handleGuessModal },
} satisfies DiscordAPIApplicationCommand
