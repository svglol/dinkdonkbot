import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { useDB } from '../../../../database/db'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../../../discord'

export const KICK_DETAILS_COMMAND = {
  type: 1,
  name: 'details',
  description: 'Show the details for a streamer you are subscribed to',
  dm_permission: false,
  options: [{
    type: 3,
    name: 'streamer',
    description: 'The name of the streamer to show',
    required: true,
    autocomplete: true,
  }],
}

export async function handleKickDetailsCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const details = command
  if (details.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const streamer = details.options?.find(option => option.name === 'streamer')?.value as string | undefined
  if (!streamer)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Missing required arguments', env)] })
  const stream = await useDB(env).query.kickStreams.findFirst({
    where: (kickStreams, { and, eq, like }) => and(like(kickStreams.name, streamer), eq(kickStreams.guildId, interaction.guild_id)),
    with: {
      multiStream: { with: { stream: true } },
    },
  })
  if (!stream)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })
  let message = `Streamer: \`${stream.name}\`\n`
  message += `Channel: <#${stream.channelId}>\n`
  message += `Live Message: \`${stream.liveMessage}\`\n`
  message += `Offline Message: \`${stream.offlineMessage}\`\n`
  message += `Cleanup: \`${stream.cleanup}\`\n`
  if (stream.roleId)
    message += `Role: <@&${stream.roleId}>\n`
  if (stream.multiStream)
    message += `Multistream linked to: ${TWITCH_EMOTE.formatted}\`${stream.multiStream.stream.name}\``

  return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(message, env, { title: `${KICK_EMOTE.formatted} Kick streamer details` })] })
}
