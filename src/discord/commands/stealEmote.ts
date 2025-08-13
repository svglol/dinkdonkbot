import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isContextMenuApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { fetchEmoteImageBuffer } from '../../util/emote'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction, uploadEmoji } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'
import { COMMAND_PERMISSIONS } from './permissions'

const STEAL_EMOTE_COMMAND = {
  name: 'Steal Emote',
  type: 3,
  default_member_permissions: COMMAND_PERMISSIONS.MANAGE_EMOJIS_AND_STICKERS,
  dm_permission: false,
}

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleStealEmoteCommand(interaction, env))
  return interactionEphemeralLoading()
}

/**
 * Handles the steal emote context menu command.
 *
 * This function retrieves a message from Discord and attempts to steal
 * the first custom emote found in the message's content. If found, it
 * uploads the emote to the current Discord server.
 *
 * @param interaction The interaction object from Discord, containing the message data.
 * @param env The environment object containing configuration and authentication details.
 * @returns A promise that resolves to nothing. Updates the interaction with a success or error message.
 */

async function handleStealEmoteCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isContextMenuApplicationCommandInteraction(interaction))
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!isGuildInteraction(interaction))
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  if (!interaction.data.resolved || !interaction.data.target_id)
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!('messages' in interaction.data.resolved)) {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Could not find the message to steal an emote from', env)] })
  }

  const messageId = interaction.data.target_id
  const message = interaction.data.resolved?.messages[messageId]
  if (!message) {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Could not find the message to steal an emote from', env)] })
  }
  const emote = message.content.match(/<a?:\w+:\d+>/)?.[0]

  if (!emote) {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Could not find an emote to steal in the provided message', env)] })
  }

  if (emote.startsWith('<a:') || emote.startsWith('<:')) {
    const isAnimated = emote.startsWith('<a:')
    const content = isAnimated ? emote.slice(3, -1) : emote.slice(2, -1)
    const [name, id] = content.split(':')
    let cleanName = name.replace(/[^\w\s]/g, '')
    cleanName = cleanName.padEnd(2, '_').slice(0, 32)
    const extension = isAnimated ? 'gif' : 'png'
    const emoteUrl = `https://cdn.discordapp.com/emojis/${id}.${extension}`

    // try {
    //   // Check if the emote already exists in the guild
    //   const emojis = await fetchGuildEmojis(interaction.guild_id, env.DISCORD_TOKEN)
    //   if (emojis.some(emoji => emoji.id === id)) {
    //     return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content: `That emote is already from this server.` })
    //   }
    // }
    // catch (error) {
    //   console.error('Error checking if emote already exists:', error)
    // }

    try {
      const imageBuffer = await fetchEmoteImageBuffer(emoteUrl)
      const discordEmote = await uploadEmoji(interaction.guild_id, env.DISCORD_TOKEN, cleanName, imageBuffer)
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`Emote added: <${isAnimated ? 'a' : ''}:${cleanName}:${discordEmote.id}>`, env)] })
    }
    catch (error) {
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`${error}`, env)] })
    }
  }

  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Something went wrong when trying to steal the emote', env)] })
}

export default {
  command: STEAL_EMOTE_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
