import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption } from 'discord-api-types/v10'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { and, eq, like } from 'drizzle-orm'
import { tables, useDB } from '@/database/db'

export const CLIPS_TWITCH_REMOVE_COMMAND = {
  type: 1,
  name: 'remove',
  description: 'Unsubscribe from Twitch clips from a streamer',
  dm_permission: false,
  options: [{
    type: 3,
    name: 'streamer',
    description: 'The name of the Twitch streamer to unsubscribe from',
    required: true,
    autocomplete: true,
  }],
}

export async function handleClipsTwitchRemoveCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const remove = command
  const streamer = remove.options?.find(option => option.name === 'streamer')?.value as string | undefined
  if (!streamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const stream = await useDB(env).query.clips.findFirst({
    where: (clips, { and, eq, like }) => and(like(clips.streamer, streamer), eq(clips.guildId, interaction.guild_id)),
  })
  if (!stream)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You are not subscribed to this streamer', env)] })

  await useDB(env).delete(tables.clips).where(and(like(tables.clips.streamer, streamer), eq(tables.clips.guildId, interaction.guild_id)))

  return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(`Unsubscribed to \`${streamer}\` for clip notifications`, env)] })
}
