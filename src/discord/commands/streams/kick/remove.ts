import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataSubcommandOption, InteractionType } from 'discord-api-types/v10'
import { tables, useDB } from '@database'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '@discord-api'
import { kickUnsubscribe } from '@kick-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { and, eq, like } from 'drizzle-orm'
import { autoCompleteResponse } from '@/discord/interactionHandler'

export const KICK_REMOVE_COMMAND = {
  type: 1,
  name: 'remove',
  description: 'Remove a Kick streamer alert subscription',
  dm_permission: false,
  options: [{
    type: 3,
    name: 'streamer',
    description: 'The name of the streamer to remove',
    required: true,
    autocomplete: true,
  }],
}

export async function handleKickRemoveCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const remove = command
  if (remove.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  const streamer = remove.options?.find(option => option.name === 'streamer')?.value as string | undefined
  if (!streamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Missing required arguments', env)] })
  const stream = await useDB(env).query.kickStreams.findFirst({
    where: (kickStreams, { eq, and, like }) => and(eq(kickStreams.guildId, interaction.guild_id), like(kickStreams.name, streamer)),
  })

  if (!stream)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

  await useDB(env).delete(tables.kickStreams).where(and(like(tables.kickStreams.name, streamer), eq(tables.kickStreams.guildId, interaction.guild_id)))
  const subscriptions = await useDB(env).query.kickStreams.findMany({
    where: (kickStreams, { like }) => like(kickStreams.name, streamer),
  })
  if (subscriptions.length === 0 && stream)
    await kickUnsubscribe(Number(stream.broadcasterId), env)

  return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(`Unsubscribed to notifications for **${streamer}**`, env)] })
}

export async function handleKickDBAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.Subcommand) {
    if (!isGuildInteraction(interaction))
      return autoCompleteResponse([])
    const streamerOption = option.options?.find(option => option.name === 'streamer')
    if (!streamerOption || !('value' in streamerOption) || !('focused' in streamerOption))
      return autoCompleteResponse([])

    if (streamerOption.focused) {
    // we can auto complete the streamer field
      const input = streamerOption.value.toLowerCase()
      const cacheKey = `autocomplete:${interaction.guild_id}:kick:${option.name}:${input}`

      // Try KV cache
      const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
      if (cached)
        return autoCompleteResponse(cached)

      const streamers = await useDB(env).query.kickStreams.findMany({
        where: (stream, { and, eq, like }) => and(eq(stream.guildId, interaction.guild_id), like(stream.name, `%${streamerOption.value}%`)),
      })
      const choices = streamers
        .map(stream => ({ name: stream.name, value: stream.name }))
        .sort((a, b) => {
          if (a.name.toLowerCase() === input.toLowerCase() && b.name.toLowerCase() !== input.toLowerCase()) {
            return -1
          }
          if (b.name.toLowerCase() === input.toLowerCase() && a.name.toLowerCase() !== input.toLowerCase()) {
            return 1
          }
          return a.name.localeCompare(b.name)
        })
      await env.KV.put(cacheKey, JSON.stringify(choices), { expirationTtl: 60 })
      return autoCompleteResponse(choices)
    }
  }
  return autoCompleteResponse([])
}
