import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIMessageComponentInteraction, APIModalSubmitInteraction } from 'discord-api-types/v10'
import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions'
import { JsonResponse } from '../util/jsonResponse'
import * as commands from './commands'
import { buildErrorEmbed, updateInteraction } from './discord'

/**
 * Handles an interaction from Discord.
 *
 * If the interaction is an application command, it checks the command name and
 * dispatches to the appropriate handler.  If the interaction is not an
 * application command, or if the command does not have a handler, it returns an
 * ephemeral error message.
 *
 * @param interaction The interaction object from Discord.
 * @param env The environment variables from Cloudflare.
 * @param ctx The context object from Cloudflare.
 *
 * @returns A response to Discord, or a promise that resolves to one.
 */
export async function discordInteractionHandler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  if (!interaction.data) {
    env.ANALYTICS.writeDataPoint({ blobs: ['invalid_interaction'], doubles: [1], indexes: [interaction.guild_id ?? ''] })
    ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] }))
    return interactionEphemeralLoading()
  }

  const handler = commands.findHandlerByName(interaction.data.name.toLowerCase())
  if (handler) {
    env.ANALYTICS.writeDataPoint({ blobs: ['command_used', interaction.data.name], doubles: [1], indexes: [interaction.guild_id ?? ''] })
    return handler(interaction, env, ctx)
  }
  else {
    env.ANALYTICS.writeDataPoint({ blobs: ['command_not_found', interaction.data.name], doubles: [1], indexes: [interaction.guild_id ?? ''] })
    ctx.waitUntil(updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Command not found', env)] }))
    return interactionEphemeralLoading()
  }
}

export async function discordInteractionAutoCompleteHandler(interaction: APIApplicationCommandAutocompleteInteraction, env: Env, ctx: ExecutionContext) {
  const handler = commands.findAutoCompleteHandlerByName(interaction.data.name.toLowerCase())
  if (handler) {
    return handler(interaction, env, ctx)
  }
  else {
    return new JsonResponse({ error: 'AutoComplete not implemented' }, { status: 400 })
  }
}

export async function discordInteractionModalHandler(interaction: APIModalSubmitInteraction, env: Env, ctx: ExecutionContext) {
  const handler = commands.findModalSubmitHandlerByName(interaction.data.custom_id.toLowerCase())
  if (handler) {
    return handler(interaction, env, ctx)
  }
  else {
    return new JsonResponse({ error: 'ModalSubmit not implemented' }, { status: 400 })
  }
}

export async function discordInteractionMessageComponentHandler(interaction: APIMessageComponentInteraction, env: Env, ctx: ExecutionContext) {
  const handler = commands.findMessageComponentHandlerByName(interaction.data.custom_id.toLowerCase())
  if (handler) {
    return handler(interaction, env, ctx)
  }
  else {
    return new JsonResponse({ error: 'MessageComponent not implemented' }, { status: 400 })
  }
}

/**
 * Returns a deferred interaction response that is ephemeral.
 *
 * A deferred ephemeral interaction response is one that only the user who
 * invoked the interaction can see.  This is useful for commands that are
 * potentially expensive or that return a large amount of data, as it allows
 * the user to see the response without spamming the channel.
 *
 * @returns A deferred interaction response that is ephemeral.
 */
export function interactionEphemeralLoading() {
  return new JsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  })
}

/**
 * Returns a deferred interaction response that is not ephemeral.
 *
 * A deferred interaction response is one that will be sent to the channel
 * that the user invoked the interaction in, but will not be sent immediately.
 * This is useful for commands that are potentially expensive or that return
 * a large amount of data, as it allows the user to see the response without
 * spamming the channel.
 *
 * @returns A deferred interaction response that is not ephemeral.
 */
export function interactionLoading() {
  return new JsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  })
}

export function deferedUpdate() {
  return new JsonResponse({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  })
}
