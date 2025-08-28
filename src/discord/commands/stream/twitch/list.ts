import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { isGuildInteraction } from 'discord-api-types/utils'
import { useDB } from '../../../../database/db'
import { TWITCH_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../../../discord'

export const TWITCH_LIST_COMMAND = {
  type: 1,
  name: 'list',
  description: 'View your subscribed Twitch streamers',
  dm_permission: false,
}

export async function handleTwitchListCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  const streams = await useDB(env).query.streams.findMany({
    where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
  })
  let streamList = 'Not subscribed to any streams'
  if (streams.length > 0) {
    streamList = streams.map(stream => `**${stream.name}** - <#${stream.channelId}>`).join('\n')
  }
  else {
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Not subscribed to any Twitch streams', env)] })
  }

  return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(streamList, env, { title: `${TWITCH_EMOTE.formatted} Twitch Streams` })] })
}
