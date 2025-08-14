import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { buildErrorEmbed, fetchGuildEmojis, updateInteraction } from '../discord'
import { interactionLoading } from '../interactionHandler'
import { COMMAND_PERMISSIONS } from './permissions'

const RANDOM_EMOTE_COMMAND = {
  name: 'randomemote',
  description: 'Post a random emote from the current server',
  default_member_permissions: COMMAND_PERMISSIONS.USE_APPLICATION_COMMANDS,
  dm_permission: false,
}

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleRandomEmoteCommand(interaction, env))
  return interactionLoading()
}

/**
 * Handle the /randomemote command.
 * @param interaction The interaction object from Discord
 * @param env The environment object
 * @returns A promise that resolves to nothing
 *
 * Fetches all emojis from the current server and returns a random one to the user.
 */
async function handleRandomEmoteCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  try {
    const emojis = await fetchGuildEmojis(interaction.guild_id, env.DISCORD_TOKEN)

    if (emojis.length === 0) {
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
        embeds: [buildErrorEmbed('This server has no custom emotes!', env)],
      })
    }

    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
    const emoteString = `<${randomEmoji.animated ? 'a' : ''}:${randomEmoji.name}:${randomEmoji.id}>`
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `${emoteString}` })
  }
  catch (error) {
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [buildErrorEmbed(`Failed to fetch random emote: ${error}`, env)],
    })
  }
}

export default {
  command: RANDOM_EMOTE_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
