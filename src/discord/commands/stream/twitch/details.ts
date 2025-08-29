import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { useDB } from '../../../../database/db'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../../../discord'

export const TWITCH_DETAILS_COMMAND = {
  type: 1,
  name: 'details',
  description: 'Show the current configuration for a Twitch streamer',
  options: [{ type: 3, name: 'streamer', description: 'Streamer name', required: true, autocomplete: true }],
}

export async function handleTwitchDetailsCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const details = command
  const streamer = details.options?.find(option => option.name === 'streamer')?.value as string | undefined
  if (!streamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  const stream = await useDB(env).query.streams.findFirst({
    where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
    with: { multiStream: { with: { kickStream: true } } },
  })
  if (!stream)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })
  let message = `Streamer: \`${stream.name}\`\n`
  message += `Channel: <#${stream.channelId}>\n`
  message += `Live Message: \`${stream.liveMessage}\`\n`
  message += `Offline Message: \`${stream.offlineMessage}\`\n`
  message += `Cleanup: \`${stream.cleanup}\`\n`
  if (stream.roleId)
    message += `Role: <@&${stream.roleId}>\n`
  if (stream.multiStream)
    message += `Multistream linked to: ${KICK_EMOTE.formatted}:\`${stream.multiStream.kickStream.name}\``

  return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(message, env, { title: `${TWITCH_EMOTE.formatted} Twitch Stream Notification Details` })] })
}
