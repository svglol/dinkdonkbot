import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import type { StreamMessage } from '@/database/db'
import { bodyBuilder, buildErrorEmbed, buildSuccessEmbed, sendMessage, updateInteraction } from '@discord-api'
import { getKickChannelV2, getKickLatestVod, getKickLivestream } from '@kick-api'
import { getLatestVOD, getStreamDetails, getStreamerDetails } from '@twitch-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { useDB } from '@/database/db'

export const KICK_TEST_COMMAND = {
  type: 1,
  name: 'test',
  description: 'Test a Kick stream alert',
  dm_permission: false,
  options: [{
    type: 3,
    name: 'streamer',
    description: 'The name of the streamer to test',
    required: true,
    autocomplete: true,
  }, {
    type: 3,
    name: 'message-type',
    description: 'Whether to test the live or offline message',
    choices: [
      { name: 'Online', value: 'live' },
      { name: 'Offline', value: 'offline' },
    ],
  }, {
    type: 5,
    name: 'multistream',
    description: 'Show the notification as if it was a multistream (only works if you have a multistream setup)',
  }, {
    type: 5,
    name: 'global',
    description: 'Show the notification for everyone in the server',
  }],
}

export async function handleKickTestCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const test = command
  if (test.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const streamer = test.options?.find(option => option.name === 'streamer')?.value as string | undefined
  if (!streamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Missing required arguments', env)] })
  const global = test.options?.find(option => option.name === 'global')?.value as boolean | undefined || false
  const stream = await useDB(env).query.kickStreams.findFirst({
    where: (kickStreams, { and, eq, like }) => and(like(kickStreams.name, streamer), eq(kickStreams.guildId, interaction.guild_id)),
    with: {
      multiStream: { with: {
        stream: true,
      } },
    },
  })
  if (!stream)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

  const messageType = test.options?.find(option => option.name === 'message-type')?.value as string | undefined || 'live'
  const multiStream = test.options?.find(option => option.name === 'multistream')?.value as boolean | undefined || false

  const [kickUser, kickLivestream] = await Promise.all([
    await getKickChannelV2(stream.name),
    await getKickLivestream(Number(stream.broadcasterId), env),
  ])

  let twitchStreamData: TwitchStream | null = null
  let twitchStreamerData: TwitchUser | null = null
  if (multiStream) {
    [twitchStreamerData, twitchStreamData] = await Promise.all([
      getStreamerDetails(stream.multiStream.stream.name, env),
      getStreamDetails(stream.multiStream.stream.name, env),
    ])
  }

  const kickVod = messageType === 'live' ? null : await getKickLatestVod(kickLivestream?.started_at || new Date().toISOString(), stream.name)
  const twitchVod = multiStream ? messageType === 'live' ? null : await getLatestVOD(stream.multiStream.stream.broadcasterId, twitchStreamData?.id || '', env) : null

  // build a fake stream message object
  const streamMessage = {
    id: 0,
    stream: multiStream ? stream.multiStream.stream : null,
    streamId: null,
    kickStream: stream,
    kickStreamId: null,
    kickStreamStartedAt: messageType === 'live' ? new Date(kickLivestream?.started_at || new Date()) : new Date(new Date(kickLivestream?.started_at || new Date()).getTime() - 3600000),
    kickStreamEndedAt: messageType === 'live' ? null : new Date(),
    twitchStreamStartedAt: messageType === 'live' ? new Date(twitchStreamData?.started_at || new Date()) : new Date(new Date(twitchStreamData?.started_at || new Date()).getTime() - 3600000),
    twitchStreamEndedAt: messageType === 'live' ? null : new Date(),
    discordChannelId: stream.channelId,
    discordMessageId: null,
    twitchStreamId: null,
    twitchOnline: multiStream ? messageType === 'live' : false,
    twitchStreamData: twitchStreamData ?? null,
    twitchStreamerData: twitchStreamerData ?? null,
    twitchVod: twitchVod ?? null,
    kickStreamData: kickLivestream ?? null,
    kickStreamerData: kickUser ?? null,
    kickVod,
    kickOnline: messageType === 'live',
    createdAt: new Date().toISOString(),
  } satisfies StreamMessage

  const body = bodyBuilder(streamMessage, env)
  if (global) {
    await sendMessage(stream.channelId, body, env)
    return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(`Sent test message for **${streamer}**`, env)] })
  }
  else {
    return await updateInteraction(interaction, env, body)
  }
}
