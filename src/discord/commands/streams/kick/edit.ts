import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord-api-types/v10'
import { and, eq, like } from 'drizzle-orm'
import { tables, useDB } from '../../../../database/db'
import { KICK_EMOTE } from '../../../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, calculateChannelPermissions, updateInteraction } from '../../../discord'

export const KICK_EDIT_COMMAND = {
  type: 1,
  name: 'edit',
  description: 'Edit config for a Kick streamer alert',
  dm_permission: false,
  options: [{
    type: 3,
    name: 'streamer',
    description: 'The name of the streamer to edit',
    required: true,
    autocomplete: true,
  }, {
    type: 7,
    name: 'discord-channel',
    description: 'The discord channel to post to when the streamer goes live',
    channel_types: [0],
  }, {
    type: 8,
    name: 'ping-role',
    description: 'What role/who to @ when the streamer goes live',
  }, {
    type: 5,
    name: 'remove-ping-role',
    description: 'Remove the current ping role (cannot be used with ping-role)',
  }, {
    type: 3,
    name: 'live-message',
    description: 'The message to post when the streamer goes live',
  }, {
    type: 3,
    name: 'offline-message',
    description: 'The message to post when the streamer goes offline',
  }, {
    type: 5,
    name: 'cleanup',
    description: 'Remove notification after the streamer goes offline',
  }],
}

export async function handleKickEditCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const server = interaction.guild_id
  const edit = command
  if (edit.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const streamer = edit.options?.find(option => option.name === 'streamer')?.value as string | undefined
  if (!streamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Missing required arguments', env)] })
  const dbStream = await useDB(env).query.kickStreams.findFirst({
    where: (kickStreams, { and, eq, like }) => and(like(kickStreams.name, streamer), eq(kickStreams.guildId, interaction.guild_id)),
    with: { multiStream: true },
  })
  if (!dbStream)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

  const channel = edit.options?.find(option => option.name === 'discord-channel')?.value as string | undefined
  if (channel) {
    if (dbStream.channelId !== channel) {
      const permissions = await calculateChannelPermissions(interaction.guild_id!, channel!, env.DISCORD_APPLICATION_ID, env, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.MentionEveryone])
      const missingPermissions = Object.entries(permissions.checks)
        .filter(([_, hasPermission]) => !hasPermission)
        .map(([permissionName]) => permissionName)

      if (missingPermissions.length > 0) {
        const permissionError = `Dinkdonk Bot does not have the required permissions use <#${channel}>.\nMissing permissions: ${missingPermissions.join(', ')}`
        console.error(permissionError)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(permissionError, env)] })
      }
      if (dbStream.multiStream) {
        await useDB(env).delete(tables.multiStream).where(eq(tables.multiStream.streamId, dbStream.id))
      }
      await useDB(env).update(tables.kickStreams).set({ channelId: channel }).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))
    }
  }
  const role = edit.options?.find(option => option.name === 'ping-role')?.value as string | undefined
  const removePingRole = edit.options?.find(option => option.name === 'remove-ping-role')?.value as boolean | undefined

  // Validate that both options aren't used together
  if (role && removePingRole) {
    return await updateInteraction(interaction, env, {
      embeds: [buildErrorEmbed('Cannot use both ping-role and remove-ping-role options at the same time', env)],
    })
  }

  if (removePingRole) {
    // User wants to remove the ping role
    await useDB(env).update(tables.streams).set({ roleId: null }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
  }
  else if (role) {
    const roleId = role === server ? undefined : role
    await useDB(env).update(tables.streams).set({ roleId }).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
  }

  const message = edit.options?.find(option => option.name === 'live-message')?.value as string | undefined
  if (message)
    await useDB(env).update(tables.kickStreams).set({ liveMessage: message }).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))

  const offlineMessage = edit.options?.find(option => option.name === 'offline-message')?.value as string | undefined
  if (offlineMessage)
    await useDB(env).update(tables.kickStreams).set({ offlineMessage }).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))

  const cleanup = edit.options?.find(option => option.name === 'cleanup')?.value as boolean | undefined
  if (cleanup !== undefined) {
    await useDB(env).update(tables.kickStreams).set({ cleanup }).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))
  }

  // get up to date sub
  const subscription = await useDB(env).query.kickStreams.findFirst({
    where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
  })
  if (!subscription)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

  let details = `Streamer: \`${subscription.name}\`\n`
  details += `Channel: <#${subscription.channelId}>\n`
  details += `Live Message: \`${subscription.liveMessage}\`\n`
  details += `Offline Message: \`${subscription.offlineMessage}\`\n`
  details += `Cleanup: \`${subscription.cleanup}\`\n`
  if (subscription.roleId)
    details += `Ping Role: <@&${subscription.roleId}>`

  return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(`${details}`, env, { title: `${KICK_EMOTE.formatted} Edited notifications for \`${streamer}\`` })] })
}
