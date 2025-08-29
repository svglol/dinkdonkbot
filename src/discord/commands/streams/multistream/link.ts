import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataSubcommandOption, InteractionType } from 'discord-api-types/v10'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { tables, useDB } from '../../../../database/db'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, findBotCommandMarkdown, updateInteraction } from '../../../discord'
import { autoCompleteResponse } from '../../../interactionHandler'

export const MULTISTREAM_LINK_COMMAND = {
  type: 1,
  name: 'link',
  description: 'Link a Twitch and Kick streamer to merge alerts into one message',
  options: [
    { type: 3, name: 'twitch-streamer', description: 'Twitch streamer (must have Twitch alert)', required: true, autocomplete: true },
    { type: 3, name: 'kick-streamer', description: 'Kick streamer (must have Kick alert)', required: true, autocomplete: true },
    {
      type: 3,
      name: 'priority',
      description: 'Which platform takes priority',
      choices: [
        { name: 'Twitch', value: 'twitch' },
        { name: 'Kick', value: 'kick' },
      ],
    },
    { type: 5, name: 'late-merge', description: 'Always merge notifications even after 15s', required: false },
  ],
}

export async function handleMultistreamLinkCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const link = command
  if (link.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const twitchStreamer = link.options?.find(option => option.name === 'twitch-streamer')?.value as string | undefined
  const kickStreamer = link.options?.find(option => option.name === 'kick-streamer')?.value as string | undefined
  const priority = link.options?.find(option => option.name === 'priority')?.value as 'twitch' | 'kick' | undefined || 'twitch'
  const lateMerge = link.options?.find(option => option.name === 'late-merge')?.value as boolean | undefined || true

  const streams = await useDB(env).query.streams.findMany({
    where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
    with: {
      multiStream: true,
    },
  })

  const kickStreams = await useDB(env).query.kickStreams.findMany({
    where: (kickStreams, { eq }) => eq(kickStreams.guildId, interaction.guild_id),
    with: {
      multiStream: true,
    },
  })

  const twitchStream = streams.find(stream => stream.name.toLowerCase() === twitchStreamer?.toLowerCase())
  const kickStream = kickStreams.find(stream => stream.name.toLowerCase() === kickStreamer?.toLowerCase())

  if (twitchStream && kickStream) {
    if (twitchStream.multiStream)
      return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`The Twitch streamer is already linked to a multistream, if you want to relink it use the ${await findBotCommandMarkdown(env, 'multistream', 'unlink')} command`, env)] })

    if (kickStream.multiStream)
      return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`The Kick streamer is already linked to a multistream, if you want to relink it use the ${await findBotCommandMarkdown(env, 'multistream', 'unlink')} command`, env)] })

    if (twitchStream.channelId !== kickStream.channelId)
      return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('The Twitch and Kick streamers must be setup to post in the same channel', env)] })

    await useDB(env).insert(tables.multiStream).values({
      streamId: twitchStream.id,
      kickStreamId: kickStream.id,
      priority,
      lateMerge,
    })

    return await updateInteraction(interaction, env, {
      embeds: [
        buildSuccessEmbed(`Priority: ${priority}\n Late Merge: ${lateMerge ? 'Enabled' : 'Disabled'}`, env, {
          title: `Successfully linked ${TWITCH_EMOTE.formatted}\`${twitchStream.name}\` + ${KICK_EMOTE.formatted}\`${kickStream.name}\``,
        }),
      ],
    })
  }
  else {
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Could not find the appropriate subscriptions to link', env)] })
  }
}

export async function handleMultistreamLinkAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  const subCommand = option
  const guildId = interaction.guild_id
  if (subCommand.type !== ApplicationCommandOptionType.Subcommand || !guildId)
    return autoCompleteResponse([])

  // Find which field is currently being focused/typed in
  const focusedOption = subCommand.options?.find(option => 'focused' in option && option.focused)
  if (!focusedOption)
    return autoCompleteResponse([])

  const focusedValue = 'value' in focusedOption ? (focusedOption.value as string) : ''
  const focusedField = focusedOption.name

  // Create cache key based on focused field and value
  const cacheKey = `autocomplete:${guildId}:multistream:link:${focusedField}:${focusedValue}`
  const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
  if (cached)
    return autoCompleteResponse(cached)

  let choices: { name: string, value: string }[] = []

  if (focusedField === 'twitch-streamer') {
    // Get all Twitch streams that aren't already linked to a multistream
    const streams = await useDB(env).query.streams.findMany({
      where: (stream, { and, eq, like }) => and(
        eq(stream.guildId, guildId),
        like(stream.name, `%${focusedValue}%`),
      ),
      with: {
        multiStream: true,
      },
    })

    // Filter out streams that are already linked
    const availableStreams = streams.filter(stream => !stream.multiStream)
    choices = availableStreams.map(stream => ({ name: stream.name, value: stream.name }))
  }
  else if (focusedField === 'kick-streamer') {
    // Get all Kick streams that aren't already linked to a multistream
    const kickStreams = await useDB(env).query.kickStreams.findMany({
      where: (stream, { and, eq, like }) => and(
        eq(stream.guildId, guildId),
        like(stream.name, `%${focusedValue}%`),
      ),
      with: {
        multiStream: true,
      },
    })

    // Filter out streams that are already linked
    const availableKickStreams = kickStreams.filter(stream => !stream.multiStream)
    choices = availableKickStreams.map(stream => ({ name: stream.name, value: stream.name }))
  }

  await env.KV.put(cacheKey, JSON.stringify(choices), { expirationTtl: 60 })
  return autoCompleteResponse(choices)
}
