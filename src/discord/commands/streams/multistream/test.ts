import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import type { Stream, StreamKick, StreamMessage } from '@/database/db'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { useDB } from '@/database/db'
import { bodyBuilder, buildErrorEmbed, buildSuccessEmbed, sendMessage, updateInteraction } from '@/discord/discord'
import { getKickChannelV2, getKickLatestVod, getKickLivestream } from '@/kick/kick'
import { getLatestVOD, getStreamDetails, getStreamerDetails } from '@/twitch/twitch'
import { KICK_EMOTE, TWITCH_EMOTE } from '@/utils/discordEmotes'

export const MULTISTREAM_TEST_COMMAND = {
  type: 1,
  name: 'test',
  description: 'Test a multistream alert',
  options: [
    { type: 3, name: 'twitch-streamer', description: 'Twitch streamer to test', required: false, autocomplete: true },
    { type: 3, name: 'kick-streamer', description: 'Kick streamer to test', required: false, autocomplete: true },
    {
      type: 3,
      name: 'message-type',
      description: 'Whether to test the live or offline message',
      choices: [
        { name: 'Online', value: 'live' },
        { name: 'Offline', value: 'offline' },
      ],
    },
    {
      type: 5,
      name: 'global',
      description: 'Show the notification for everyone in the server',
    },
  ],
}

export async function handleMultistreamTestCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const test = command
  if (command.type !== ApplicationCommandOptionType.Subcommand || !isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  const twitchStreamer = test.options?.find(option => option.name === 'twitch-streamer')?.value as string | undefined
  const kickStreamer = test.options?.find(option => option.name === 'kick-streamer')?.value as string | undefined
  const global = test.options?.find(option => option.name === 'global')?.value as boolean | undefined || false
  const messageType = test.options?.find(option => option.name === 'message-type')?.value as string | undefined || 'live'

  if (!twitchStreamer && !kickStreamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You must specify a Twitch or Kick streamer to test alerts for', env)] })

  let twitchStream: Stream | undefined
  let kickStream: StreamKick | undefined
  if (twitchStreamer && !kickStreamer) {
    twitchStream = await useDB(env).query.streams.findFirst({
      where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id) && eq(streams.name, twitchStreamer || ''),
      with: {
        multiStream: true,
      },
    })
    kickStream = await useDB(env).query.kickStreams.findFirst({
      where: (kickStreams, { eq }) => eq(kickStreams.guildId, interaction.guild_id) && eq(kickStreams.id, twitchStream?.multiStream?.kickStreamId || 0),
      with: {
        multiStream: true,
      },
    })
  }
  else if (kickStreamer && !twitchStreamer) {
    kickStream = await useDB(env).query.kickStreams.findFirst({
      where: (kickStreams, { eq }) => eq(kickStreams.guildId, interaction.guild_id) && eq(kickStreams.name, kickStreamer || ''),
      with: {
        multiStream: true,
      },
    })
    twitchStream = await useDB(env).query.streams.findFirst({
      where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id) && eq(streams.id, kickStream?.multiStream?.streamId || 0),
      with: {
        multiStream: true,
      },
    })
  }
  else {
    kickStream = await useDB(env).query.kickStreams.findFirst({
      where: (kickStreams, { eq }) => eq(kickStreams.guildId, interaction.guild_id) && eq(kickStreams.name, kickStreamer || ''),
      with: {
        multiStream: true,
      },
    })
    twitchStream = await useDB(env).query.streams.findFirst({
      where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id) && eq(streams.name, twitchStreamer || ''),
      with: {
        multiStream: true,
      },
    })

    if (twitchStream?.multiStream?.kickStreamId !== kickStream?.id || kickStream?.multiStream?.streamId !== twitchStream?.id)
      return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('The specified Twitch and Kick streamers are not linked together', env)] })
  }

  if (!twitchStream || !kickStream)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('The specified Twitch or Kick streamer is not linked to a multistream, check they are linked correctly', env)] })

  const [kickUser, kickLivestream, twitchStreamerData, twitchStreamData] = await Promise.all([
    await getKickChannelV2(kickStream.name),
    await getKickLivestream(Number(kickStream.broadcasterId), env),
    getStreamerDetails(twitchStream.name, env),
    getStreamDetails(twitchStream.name, env),
  ])

  const kickVod = messageType === 'live' ? null : await getKickLatestVod(kickLivestream?.started_at || new Date().toISOString(), kickStream.name)
  const twitchVod = messageType === 'live' ? null : await getLatestVOD(twitchStream.broadcasterId, twitchStreamData?.id || '', env)

  const streamMessage = {
    id: 0,
    stream: twitchStream,
    streamId: null,
    kickStream,
    kickStreamId: null,
    kickStreamStartedAt: messageType === 'live' ? new Date(kickLivestream?.started_at || new Date()) : new Date(new Date(kickLivestream?.started_at || new Date()).getTime() - 3600000),
    kickStreamEndedAt: messageType === 'live' ? null : new Date(),
    twitchStreamStartedAt: messageType === 'live' ? new Date(twitchStreamData?.started_at || new Date()) : new Date(new Date(twitchStreamData?.started_at || new Date()).getTime() - 3600000),
    twitchStreamEndedAt: messageType === 'live' ? null : new Date(),
    discordChannelId: twitchStream.channelId,
    discordMessageId: null,
    twitchStreamId: null,
    twitchOnline: messageType === 'live',
    twitchStreamData: twitchStreamData ?? null,
    twitchStreamerData: twitchStreamerData ?? null,
    twitchVod: twitchVod ?? null,
    kickStreamData: kickLivestream ?? null,
    kickStreamerData: kickUser ?? null,
    kickVod,
    kickOnline: messageType === 'live',
    createdAt: new Date().toISOString(),
  } satisfies StreamMessage

  const body = await bodyBuilder(streamMessage, env)

  if (global) {
    await sendMessage(twitchStream.channelId, body, env)
    return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(`Sent test multistream alert message for **${TWITCH_EMOTE.formatted}\`${twitchStream.name}\` + ${KICK_EMOTE.formatted}\`${kickStream.name}\`**`, env)] })
  }
  else {
    return await updateInteraction(interaction, env, body)
  }
}
