import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataSubcommandOption, InteractionType } from 'discord-api-types/v10'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '@discord-api'
import { removeSubscription } from '@twitch-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { and, eq, like } from 'drizzle-orm'
import { tables, useDB } from '@/database/db'
import { autoCompleteResponse } from '@/discord/interactionHandler'

export const TWITCH_REMOVE_COMMAND = {
  type: 1,
  name: 'remove',
  description: 'Remove a Twitch streamer alert subscription',
  options: [{ type: 3, name: 'streamer', description: 'Streamer name', required: true, autocomplete: true }],
}

export async function handleTwitchRemoveCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  if (!command)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const streamer = command.options?.find(option => option.name === 'streamer')?.value as string | undefined
  if (!streamer)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  const stream = await useDB(env).query.streams.findFirst({
    where: (streams, { and, eq, like }) => and(like(streams.name, streamer), eq(streams.guildId, interaction.guild_id)),
  })
  if (!stream)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

  await useDB(env).delete(tables.streams).where(and(like(tables.streams.name, streamer), eq(tables.streams.guildId, interaction.guild_id)))
  const subscriptions = await useDB(env).query.streams.findMany({
    where: (streams, { like }) => like(streams.name, streamer),
  })
  if (subscriptions.length === 0 && stream)
    await removeSubscription(stream.broadcasterId, env)

  return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(`Unsubscribed from notifications for **${streamer}**`, env)] })
}

export async function handleTwitchDBAutoComplete(interaction: APIApplicationCommandAutocompleteInteraction, option: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommandAutocomplete>, env: Env) {
  if (option.type === ApplicationCommandOptionType.Subcommand) {
    if (!isGuildInteraction(interaction))
      return autoCompleteResponse([])
    const streamerOption = option.options?.find(option => option.name === 'streamer')
    if (!streamerOption || !('value' in streamerOption) || !('focused' in streamerOption))
      return autoCompleteResponse([])

    if (streamerOption.focused) {
      // we can auto complete the streamer field
      const input = streamerOption.value.toLowerCase()
      const cacheKey = `autocomplete:${interaction.guild_id}:clips:${option.name}:${input}`

      // Try KV cache
      const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
      if (cached)
        return autoCompleteResponse(cached)

      const streamers = await useDB(env).query.streams.findMany({
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
