import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { tables, useDB } from '@database'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { and, eq, like } from 'drizzle-orm'

export const CLIPS_KICK_REMOVE_COMMAND = {
  type: 1,
  name: 'remove',
  description: '(BETA) Unsubscribe from KICK clips from a streamer',
  dm_permission: false,
  options: [{
    type: 3,
    name: 'streamer',
    description: 'The name of the KICK streamer to unsubscribe from',
    required: true,
    autocomplete: true,
  }],
}

export async function handleClipsKickRemoveCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const remove = command
  const streamer = remove.options?.find(option => option.name === 'streamer')?.value as string | undefined
  if (!streamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const clips = await useDB(env).query.kickClips.findFirst({
    where: (clips, { and, eq, like }) => and(like(clips.streamer, streamer), eq(clips.guildId, interaction.guild_id)),
  })
  if (!clips)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You are not subscribed to this streamer', env)] })

  await useDB(env).delete(tables.kickClips).where(and(like(tables.kickClips.streamer, streamer), eq(tables.kickClips.guildId, interaction.guild_id)))

  return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(`Unsubscribed to \`${streamer}\` for clip notifications`, env)] })
}
