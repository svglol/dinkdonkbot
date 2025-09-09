import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIMessageComponentInteraction, APIMessageTopLevelComponent, APIModalSubmitInteraction } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '@discord-api'
import { escapeMarkdown } from '@discordjs/formatters'
import { getClips } from '@twitch-api'
import { ButtonStyle, ComponentType } from 'discord-api-types/v10'
import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName, getSubcommandInfo } from '@/utils/commandsHelper'
import { JsonResponse } from '@/utils/jsonResponse'

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
    ctx.waitUntil(updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] }))
    return interactionEphemeralLoading()
  }

  const handler = findHandlerByName(interaction.data.name.toLowerCase())
  if (handler) {
    const { commandName, subcommandGroup, subcommand } = getSubcommandInfo(interaction)
    const userId = interaction.member?.user.id || interaction.user?.id
    env.ANALYTICS.writeDataPoint({ blobs: ['command_used', commandName, subcommandGroup ?? '', subcommand ?? '', userId ?? ''], doubles: [1], indexes: [interaction.guild_id ?? ''] })
    return handler(interaction, env, ctx)
  }
  else {
    env.ANALYTICS.writeDataPoint({ blobs: ['command_not_found', interaction.data.name], doubles: [1], indexes: [interaction.guild_id ?? ''] })
    ctx.waitUntil(updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Command not found', env)] }))
    return interactionEphemeralLoading()
  }
}

/**
 * Handles an autocomplete interaction from Discord.
 *
 * If the interaction is an autocomplete interaction, it checks the command name
 * and dispatches to the appropriate handler.  If the interaction is not an
 * autocomplete interaction, or if the command does not have a handler, it
 * returns a 400 error response.
 *
 * @param interaction The interaction object from Discord.
 * @param env The environment variables from Cloudflare.
 * @param ctx The context object from Cloudflare.
 *
 * @returns A response to Discord, or a promise that resolves to one.
 */
export async function discordInteractionAutoCompleteHandler(interaction: APIApplicationCommandAutocompleteInteraction, env: Env, ctx: ExecutionContext) {
  const handler = findAutoCompleteHandlerByName(interaction.data.name.toLowerCase())
  if (handler) {
    return handler(interaction, env, ctx)
  }
  else {
    return autoCompleteResponse([])
  }
}

/**
 * Handles a modal submit interaction from Discord.
 *
 * If the interaction is a modal submit, it checks the custom ID and
 * dispatches to the appropriate handler.  If the interaction is not a
 * modal submit, or if the custom ID does not have a handler, it returns a
 * 400 error response.
 *
 * @param interaction The interaction object from Discord.
 * @param env The environment variables from Cloudflare.
 * @param ctx The context object from Cloudflare.
 *
 * @returns A response to Discord, or a promise that resolves to one.
 */
export async function discordInteractionModalHandler(interaction: APIModalSubmitInteraction, env: Env, ctx: ExecutionContext) {
  const handler = findModalSubmitHandlerByName(interaction.data.custom_id.toLowerCase())
  if (handler) {
    return handler(interaction, env, ctx)
  }
  else {
    return new JsonResponse({ error: 'ModalSubmit not implemented' }, { status: 400 })
  }
}

/**
 * Handles a message component interaction from Discord.
 *
 * If the interaction is a message component, it checks the custom ID and
 * dispatches to the appropriate handler.  If the interaction is not a message
 * component, or if the custom ID does not have a handler, it returns a 400
 * error response.
 *
 * @param interaction The interaction object from Discord.
 * @param env The environment variables from Cloudflare.
 * @param ctx The context object from Cloudflare.
 *
 * @returns A response to Discord, or a promise that resolves to one.
 */
export async function discordInteractionMessageComponentHandler(interaction: APIMessageComponentInteraction, env: Env, ctx: ExecutionContext) {
  const handler = findMessageComponentHandlerByName(interaction.data.custom_id.toLowerCase())
  if (handler) {
    return handler(interaction, env, ctx)
  }
  else if (interaction.data.custom_id.toLowerCase().startsWith('top-clips:')) {
    const broadcasterId = interaction.data.custom_id.split(':')[1]
    const startDate = new Date(Number(interaction.data.custom_id.split(':')[2]))
    const endDate = new Date(Number(interaction.data.custom_id.split(':')[3]))
    ctx.waitUntil(handleTopClipsCommand(interaction, env, broadcasterId, startDate, endDate))
    return interactionEphemeralLoading()
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

/**
 * Returns a deferred interaction response that is a message update.
 *
 * A deferred message update is one that will be sent to the channel
 * that the user invoked the interaction in, but will not be sent immediately.
 * Instead, the interaction will be acknowledged, and the message will be
 * updated later.  This is useful for commands that are potentially expensive
 * or that return a large amount of data, as it allows the user to see the
 * response without spamming the channel.
 *
 * @returns A deferred interaction response that is a message update.
 */
export function deferedUpdate() {
  return new JsonResponse({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  })
}

/**
 * Returns an autocomplete response for a Discord interaction.
 *
 * @param options The options to include in the response.
 *
 * @returns A response to Discord, or a promise that resolves to one.
 */
export function autoCompleteResponse(options: { name: string, value: string }[]) {
  return new JsonResponse({
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: {
      choices: options.slice(0, 25),
    },
  })
}
async function handleTopClipsCommand(interaction: APIMessageComponentInteraction, env: Env, broadcasterId: string, startDate: Date, endDate: Date) {
  const clips = await getClips(broadcasterId, startDate, endDate, env)
  if (clips && clips.data && clips.data.length > 0) {
    const components: APIMessageTopLevelComponent[] = []

    for (const clip of clips.data) {
      components.push({
        type: ComponentType.Container,
        accent_color: 0x6441A4,
        components: [
          {
            type: ComponentType.Section,
            components: [
              {
                type: ComponentType.TextDisplay,
                content: `## ${escapeMarkdown(clip.title)}\n**${clip.view_count.toLocaleString()}** views • **${Math.floor(clip.duration)}s** • Clipped by **${escapeMarkdown(clip.creator_name)}**`,
              },
            ],
            accessory: {
              type: 11,
              media: {
                url: clip.thumbnail_url,
              },
            },
          },

          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                url: clip.url,
                label: 'Watch Clip',
              },
            ],
          },
        ],

      })
    }
    await updateInteraction(interaction, env, { components, flags: 1 << 15 })
  }
  else {
    await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('We could not find any clips from this stream 😢', env, { title: 'No clips found :(' })] })
  }
}
