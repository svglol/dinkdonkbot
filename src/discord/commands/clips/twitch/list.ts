import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { useDB } from '@database'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { TWITCH_EMOTE } from '@/utils/discordEmotes'

export const CLIPS_TWITCH_LIST_COMMAND = {
  type: 1,
  name: 'list',
  description: 'View your subscribed Twitch clip channels',
  dm_permission: false,
}

export async function handleClipsTwitchListCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const clips = await useDB(env).query.clips.findMany({
    where: (clips, { eq }) => eq(clips.guildId, interaction.guild_id),
  })
  let clipsList = 'Not subscribed to recive clip notifications for any streams'
  if (clips.length > 0)
    clipsList = clips.map(stream => `**${stream.streamer}** - <#${stream.channelId}>`).join('\n')

  return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(clipsList, env, { title: `${TWITCH_EMOTE.formatted} Clip Notifications` })] })
}
