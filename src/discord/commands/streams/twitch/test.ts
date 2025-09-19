import type { StreamMessage } from '@database'
import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { useDB } from '@database'
import { bodyBuilder, buildErrorEmbed, buildSuccessEmbed, sendMessage, updateInteraction } from '@discord-api'
import { getKickChannelV2, getKickLatestVod, getKickLivestream } from '@kick-api'
import { getLatestVOD, getStreamDetails, getStreamerDetails } from '@twitch-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'

export const TWITCH_TEST_COMMAND = {
  type: 1,
  name: 'test',
  description: 'Test a Twitch stream alert',
  options: [
    { type: 3, name: 'streamer', description: 'Streamer name', required: true, autocomplete: true },
    {
      type: 3,
      name: 'message-type',
      description: 'Online or offline message',
      choices: [
        { name: 'Online', value: 'live' },
        { name: 'Offline', value: 'offline' },
      ],
    },
    { type: 5, name: 'multistream', description: 'Show as if multistream' },
    { type: 5, name: 'global', description: 'Show for everyone' },
  ],
}

export async function handleTwitchTestCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  const test = command
  const streamer = test.options?.find(option => option.name === 'streamer')?.value as string | undefined
  const global = test.options?.find(option => option.name === 'global')?.value as boolean | undefined || false
  const stream = await useDB(env).query.streams.findFirst({
    where: (streams, { and, eq, like }) => and(like(streams.name, streamer || ''), eq(streams.guildId, interaction.guild_id)),
    with: {
      multiStream: {
        with: {
          kickStream: true,
        },
      },
    },
  })
  if (!stream)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

  const messageType = test.options?.find(option => option.name === 'message-type')?.value as string | undefined || 'live'
  const multiStream = test.options?.find(option => option.name === 'multistream')?.value as boolean | undefined || false

  const [streamerData, streamData] = await Promise.all([
    getStreamerDetails(stream.name, env),
    getStreamDetails(stream.name, env),
  ])

  let kickStreamData: KickLiveStream | null = null
  let kickStreamerData: KickChannelV2 | null = null
  if (multiStream) {
    [kickStreamerData, kickStreamData] = await Promise.all([
      await getKickChannelV2(stream.multiStream.kickStream.name) ?? null,
      await getKickLivestream(Number(stream.multiStream.kickStream.broadcasterId), env) ?? null,
    ])
  }

  const kickVod = multiStream ? messageType === 'live' ? null : await getKickLatestVod(kickStreamData?.started_at || new Date().toISOString(), stream.name) : null
  const twitchVod = messageType === 'live' ? null : await getLatestVOD(stream.broadcasterId, streamData?.id || '', env)

  // build a fake stream message object
  const streamMessage = {
    id: 0,
    streamId: stream.id,
    stream,
    kickStream: multiStream ? stream.multiStream.kickStream : null,
    kickStreamId: multiStream ? stream.multiStream.kickStreamId : null,
    kickStreamStartedAt: multiStream ? messageType === 'live' ? new Date(kickStreamData?.started_at || new Date()) : new Date(new Date(kickStreamData?.started_at || new Date()).getTime() - 3600000) : messageType === 'live' ? new Date() : null,
    kickStreamEndedAt: multiStream ? messageType === 'live' ? null : new Date() : null,
    twitchStreamStartedAt: messageType === 'live' ? new Date(streamData?.started_at || new Date()) : new Date(new Date(streamData?.started_at || new Date()).getTime() - 3600000),
    twitchStreamEndedAt: messageType === 'live' ? null : new Date(),
    discordChannelId: stream.channelId,
    discordMessageId: null,
    twitchStreamId: streamData?.id || null,
    twitchOnline: messageType === 'live',
    twitchStreamData: streamData,
    twitchStreamerData: streamerData,
    twitchVod: twitchVod ?? null,
    kickStreamData,
    kickStreamerData,
    kickVod,
    kickOnline: multiStream ? messageType === 'live' : false,
    createdAt: new Date().toISOString(),
  } satisfies StreamMessage

  const body = await bodyBuilder(streamMessage, env)
  if (global) {
    await sendMessage(stream.channelId, body, env)
    return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed('Sent test message', env)] })
  }
  else {
    return await updateInteraction(interaction, env, body)
  }
}
