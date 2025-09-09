import type { MultiStream } from '@database'
import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { tables, useDB } from '@database'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { eq } from 'drizzle-orm'
import { KICK_EMOTE, TWITCH_EMOTE } from '@/utils/discordEmotes'

export const MULTISTREAM_EDIT_COMMAND = {
  type: 1,
  name: 'edit',
  description: 'Edit a multistream link',
  options: [
    { type: 3, name: 'twitch-streamer', description: 'Twitch streamer to edit', required: false, autocomplete: true },
    { type: 3, name: 'kick-streamer', description: 'Kick streamer to edit', required: false, autocomplete: true },
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

export async function handleMultistreamEditCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const edit = command
  if (edit.type !== ApplicationCommandOptionType.Subcommand || !isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  const twitchStreamer = edit.options?.find(option => option.name === 'twitch-streamer')?.value as string | undefined
  const kickStreamer = edit.options?.find(option => option.name === 'kick-streamer')?.value as string | undefined

  const priority = edit.options?.find(option => option.name === 'priority')?.value as 'twitch' | 'kick' | undefined
  const lateMerge = edit.options?.find(option => option.name === 'late-merge')?.value as boolean | undefined

  if (!twitchStreamer && !kickStreamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You must specify either a Twitch or Kick streamer to edit', env)] })

  if (!priority && lateMerge === undefined)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You must specify a priority or late merge to update', env)] })

  let multiStreamToEdit: MultiStream | null = null
  let streamerName = ''

  if (twitchStreamer) {
    const streams = await useDB(env).query.streams.findMany({
      where: (streams, { eq, and }) => and(eq(streams.guildId, interaction.guild_id), eq(streams.name, twitchStreamer)),
      with: {
        multiStream: {
          with: {
            kickStream: true,
          },
        },
      },
    })

    const streamWithMultiStream = streams.find(stream => stream.multiStream)
    if (streamWithMultiStream?.multiStream) {
      multiStreamToEdit = streamWithMultiStream.multiStream
      streamerName = `${TWITCH_EMOTE.formatted}:${twitchStreamer} + ${KICK_EMOTE.formatted}:${streamWithMultiStream.multiStream.kickStream.name}`
    }
  }
  else if (kickStreamer) {
    const kickStreams = await useDB(env).query.kickStreams.findMany({
      where: (kickStreams, { eq, and }) => and(eq(kickStreams.guildId, interaction.guild_id), eq(kickStreams.name, kickStreamer)),
      with: {
        multiStream: {
          with: {
            stream: true,
          },
        },
      },
    })

    const kickStreamWithMultiStream = kickStreams.find(stream => stream.multiStream)
    if (kickStreamWithMultiStream?.multiStream) {
      multiStreamToEdit = kickStreamWithMultiStream.multiStream
      streamerName = `${TWITCH_EMOTE.formatted}:${kickStreamWithMultiStream.multiStream.stream.name} + ${KICK_EMOTE.formatted}:${kickStreamer}`
    }
  }

  if (!multiStreamToEdit) {
    return await updateInteraction(interaction, env, {
      embeds: [buildErrorEmbed('Could not find a multistream setup for the specified streamer', env)],
    })
  }

  // Update the multistream settings
  await useDB(env).update(tables.multiStream).set({ priority, lateMerge }).where(eq(tables.multiStream.id, multiStreamToEdit.id))

  return await updateInteraction(interaction, env, {
    embeds: [
      buildSuccessEmbed(`${priority ? `Priority updated to: ${priority}` : ''}  ${lateMerge !== undefined ? `Late merge updated to: ${lateMerge}` : ''}`, env, {
        title: `Successfully updated \`${streamerName}\` multistream settings`,
      }),
    ],
  })
}
