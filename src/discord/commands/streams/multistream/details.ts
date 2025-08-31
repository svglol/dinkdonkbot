import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import type { MultiStream, Stream, StreamKick } from '../../../../database/db'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { useDB } from '../../../../database/db'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../../../discord'

export const MULTISTREAM_DETAILS_COMMAND = {
  type: 1,
  name: 'details',
  description: 'Show the current configuration for a Twitch/Kick multistream',
  dm_permission: false,
  options: [
    { type: 3, name: 'twitch-streamer', description: 'Twitch streamer to edit', required: false, autocomplete: true },
    { type: 3, name: 'kick-streamer', description: 'Kick streamer to edit', required: false, autocomplete: true },
  ],
}

export async function handleMultistreamDetailsCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const details = command
  if (details.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const twitchStreamer = details.options?.find(option => option.name === 'twitch-streamer')?.value as string | undefined
  const kickStreamer = details.options?.find(option => option.name === 'kick-streamer')?.value as string | undefined

  if (!twitchStreamer && !kickStreamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You must specify either a Twitch or Kick streamer to view details of', env)] })

  let multiStream: MultiStream & { stream?: Stream, kickStream?: StreamKick } | null = null
  if (twitchStreamer) {
    const stream = await useDB(env).query.streams.findFirst({
      where: (streams, { and, eq, like }) => and(like(streams.name, twitchStreamer), eq(streams.guildId, interaction.guild_id)),
      with: {
        multiStream: { with: { stream: true, kickStream: true } },
      },
    })
    if (!stream)
      return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this Twitch streamer: \`${twitchStreamer}\``, env)] })

    multiStream = stream.multiStream
  }
  if (kickStreamer) {
    const kickStream = await useDB(env).query.kickStreams.findFirst({
      where: (streams, { and, eq, like }) => and(like(streams.name, kickStreamer), eq(streams.guildId, interaction.guild_id)),
      with: {
        multiStream: { with: { stream: true, kickStream: true } },
      },
    })
    if (!kickStream)
      return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this Kick streamer: \`${kickStreamer}\``, env)] })

    if (multiStream !== null && multiStream?.kickStreamId !== kickStream.id)
      return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`This Kick streamer \`${kickStreamer}\` is not linked to the Twitch streamer: \`${twitchStreamer}\``, env)] })

    multiStream = kickStream.multiStream
  }

  if (!multiStream || !multiStream.stream || !multiStream.kickStream)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`Multistream is not linked to any Twitch or Kick streamer you have provided`, env)] })

  let message = `${TWITCH_EMOTE.formatted}Twitch Streamer: \`${multiStream.stream.name}\`\n`
  message += `${KICK_EMOTE.formatted}Kick Streamer: \`${multiStream.kickStream.name}\`\n`
  message += `Channel: <#${multiStream.stream.channelId}>\n`
  message += `Priority: \`${multiStream.priority}\`\n`
  message += `Late Merge: \`${multiStream.lateMerge}\``

  return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(message, env, { title: `Multistream Details` })] })
}
