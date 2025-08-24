import type { APIApplicationCommandInteraction, APIMessageComponentInteraction, APIModalSubmitInteraction } from 'discord-api-types/v10'
import type { HangmanGame } from '../../../server'
import { isGuildInteraction } from 'discord-api-types/utils'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { InteractionResponseType } from 'discord-interactions'
import { JsonResponse } from '../../../util/jsonResponse'
import { buildErrorEmbed, updateInteraction } from '../../discord'
import { interactionEphemeralLoading, interactionLoading } from '../../interactionHandler'

const HANGMAN_COMMAND = {
  name: 'hangman',
  description: 'Create a community game of hangman',
  dm_permission: false,
  default_member_permissions: PermissionFlagsBits.UseApplicationCommands.toString(),
}

/**
 * Handles the /rps command.
 * @param interaction The interaction object from Discord
 * @param env The environment object containing configuration and authentication details.
 * @param ctx The context object from Cloudflare
 * @returns A promise that resolves to nothing. Updates the interaction with a coinflip emote.
 */
function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  if (!isGuildInteraction(interaction)) {
    ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] }))
    return interactionEphemeralLoading()
  }
  return new JsonResponse({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: 'hangman_start_modal',
      title: 'Start a Hangman Game',
      components: [
        {
          type: 1,
          components: [
            {
              custom_id: 'hangman_phrase_input',
              type: 4,
              label: 'Word or Phrase (leave empty for random)',
              style: 1,
              min_length: 0,
              max_length: 100,
              placeholder: 'Enter your word or phrase here',
              required: false,
            },
          ],
        },
      ],
    },
  })
}

async function handleStartModal(interaction: APIModalSubmitInteraction, env: Env, ctx: ExecutionContext) {
  const durableObjectId = env.HANGMANGAME.idFromName(interaction.id)
  const durableObject: DurableObjectStub<HangmanGame> = env.HANGMANGAME.get(durableObjectId)
  ctx.waitUntil(durableObject.startGameModal(interaction))
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
  modalSubmitHandlers: { hangman_guess_modal: handleGuessModal, hangman_start_modal: handleStartModal },
} satisfies DiscordAPIApplicationCommand
