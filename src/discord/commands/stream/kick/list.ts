import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { isGuildInteraction } from 'discord-api-types/utils'
import { useDB } from '../../../../database/db'
import { KICK_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../../../discord'

export const KICK_LIST_COMMAND = {
  type: 1,
  name: 'list',
  description: 'View all of your Kick stream alerts',
  dm_permission: false,
}

export async function handleKickListCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const streams = await useDB(env).query.kickStreams.findMany({
    where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
  })
  let streamList = 'Not subscribed to any kick streams'
  if (streams.length > 0)
    streamList = streams.map(stream => `**${stream.name}** - <#${stream.channelId}>`).join('\n')

  return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`${streamList}`, env, { title: `${KICK_EMOTE.formatted} Kick Streams` })] })
}
