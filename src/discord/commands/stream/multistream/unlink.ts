import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataSubcommandOption, InteractionType } from 'discord-api-types/v10'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { eq } from 'drizzle-orm'
import { tables, useDB } from '../../../../database/db'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../../../discord'
import { autoCompleteResponse } from '../../../interactionHandler'

export const MULTISTREAM_UNLINK_COMMAND = {
  type: 1,
  name: 'unlink',
  description: 'Remove a multistream connection between a Twitch & Kick Channel',
  options: [
    { type: 3, name: 'twitch-streamer', description: 'Twitch streamer to remove', required: false, autocomplete: true },
    { type: 3, name: 'kick-streamer', description: 'Kick streamer to remove', required: false, autocomplete: true },
  ],
}

export async function handleMultistreamUnlinkCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const unlink = command
  if (command.type !== ApplicationCommandOptionType.Subcommand || !isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  const twitchStreamer = unlink.options?.find(option => option.name === 'twitch-streamer')?.value as string | undefined
  const kickStreamer = unlink.options?.find(option => option.name === 'kick-streamer')?.value as string | undefined

  if (!twitchStreamer && !kickStreamer)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('You must specify a Twitch or Kick streamer to unlink', env)] })

  const streams = await useDB(env).query.streams.findMany({
    where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
    with: {
      multiStream: { with: { kickStream: true, stream: true } },
    },
  })

  const multiStreams = streams.filter(stream => stream.multiStream)

  const twitchStream = multiStreams.find(stream => stream.name.toLowerCase() === twitchStreamer?.toLowerCase())
  const kickStream = multiStreams.find(stream => stream.name.toLowerCase() === kickStreamer?.toLowerCase())

  if (twitchStream || kickStream) {
    const multiStream = twitchStream?.multiStream || kickStream?.multiStream

    if (multiStream)
      await useDB(env).delete(tables.multiStream).where(eq(tables.multiStream.id, multiStream.id))

    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [
        buildSuccessEmbed(` `, env, {
          title: `Successfully removed ${TWITCH_EMOTE.formatted}\`${multiStream?.stream?.name}\` + ${KICK_EMOTE.formatted}\`${multiStream?.kickStream?.name}\` multistream link`,
        }),
      ],
    })
  }
  else {
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Could not find the appropriate subscriptions to remove', env)] })
  }
}

export async function handleMultistreamUnlinkAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  const subCommand = option
  if (subCommand.type !== ApplicationCommandOptionType.Subcommand || !isGuildInteraction(interaction))
    return autoCompleteResponse([])

  // Find which field is currently being focused/typed in
  const focusedOption = subCommand.options?.find(option => 'focused' in option && option.focused)
  if (!focusedOption)
    return autoCompleteResponse([])

  const focusedValue = 'value' in focusedOption ? (focusedOption.value as string) : ''
  const focusedField = focusedOption.name

  // Create cache key based on focused field and value
  const cacheKey = `autocomplete:${interaction.guild_id}:multistream:${subCommand.name}:${focusedField}:${focusedValue}`
  const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
  if (cached)
    return autoCompleteResponse(cached)

  let choices: { name: string, value: string }[] = []

  if (focusedField === 'twitch-streamer') {
    const twitchStreams = await useDB(env).query.streams.findMany({
      where: (streams, { and, eq, like }) => and(
        eq(streams.guildId, interaction.guild_id),
        like(streams.name, `%${focusedValue}%`),
      ),
      with: {
        multiStream: true,
      },
    })

    // Only show streams that ARE linked to multistreams
    const linkedStreams = twitchStreams.filter(stream => stream.multiStream)
    choices = linkedStreams.map(stream => ({ name: stream.name, value: stream.name }))
  }
  else if (focusedField === 'kick-streamer') {
    const kickStreams = await useDB(env).query.kickStreams.findMany({
      where: (stream, { and, eq, like }) => and(
        eq(stream.guildId, interaction.guild_id),
        like(stream.name, `%${focusedValue}%`),
      ),
      with: {
        multiStream: true,
      },
    })

    // Only show streams that ARE linked to multistreams
    const linkedKickStreams = kickStreams.filter(stream => stream.multiStream)
    choices = linkedKickStreams.map(stream => ({ name: stream.name, value: stream.name }))
  }

  // Cache the results for 60 seconds
  await env.KV.put(cacheKey, JSON.stringify(choices), { expirationTtl: 60 })
  return autoCompleteResponse(choices)
}
