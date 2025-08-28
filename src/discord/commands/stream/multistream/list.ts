import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { isGuildInteraction } from 'discord-api-types/utils'
import { useDB } from '../../../../database/db'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../../../discord'

export const MULTISTREAM_LIST_COMMAND = {
  type: 1,
  name: 'list',
  description: 'View all of your multistream links',
  dm_permission: false,
}

export async function handleMultistreamListCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  const streams = await useDB(env).query.streams.findMany({
    where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
    with: {
      multiStream: {
        with: {
          stream: true,
          kickStream: true,
        },
      },
    },
  })

  const multiStreams = streams.filter(stream => stream.multiStream).flatMap(stream => stream.multiStream)

  if (multiStreams.length > 0) {
    const list = multiStreams.map(multistream => `${TWITCH_EMOTE.formatted}\`${multistream.stream.name}\` ${KICK_EMOTE.formatted}\`${multistream.kickStream.name}\` ${'Priority: '}${multistream.priority === 'twitch' ? TWITCH_EMOTE.formatted : KICK_EMOTE.formatted} Late Merge: ${multistream.lateMerge ? 'Enabled' : 'Disabled'}`).join('\n')
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(list, env, { title: 'Multistream Links', color: 0xFFF200 })] })
  }
  else {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('No multistream links found!', env)] })
  }
}
