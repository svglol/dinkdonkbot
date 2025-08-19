import type { APIApplicationCommandInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { fetch7tvEmoteImageBuffer, fetchEmoteImageBuffer, fetchSingular7tvEmote } from '../../util/emote'
import { buildErrorEmbed, buildSuccessEmbed, fetchGuildEmojis, updateInteraction, uploadEmoji } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'
import { COMMAND_PERMISSIONS } from './permissions'

const EMOTE_COMMAND = {
  name: 'emote',
  description: 'Manage discord custom emotes',
  default_member_permissions: COMMAND_PERMISSIONS.MANAGE_EMOJIS_AND_STICKERS,
  dm_permission: false,
  options: [
    {
      type: 1,
      name: 'add',
      description: 'Add an emote from another discord server or 7tv',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'url_or_emoji',
        description: 'The URL or emoji to add',
        required: true,
      }],
    },
    {
      type: 1,
      name: 'help',
      description: 'Show help for the emote command',
      dm_permission: false,
    },
  ],
}

export const EMOTE_HELP_MESSAGE = `- </emote add:1348421861339304067> - Add an emote from another Discord server or 7tv  
- </emote help:1348421861339304067> - Show this help message  
- \`Context Menu -> Apps -> Steal Emote\` - Use this option to take an emote directly from someone else's message and add it to your server
`

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleEmoteCommand(interaction, env))
  return interactionEphemeralLoading()
}

/**
 * Handle the /emote command.
 * @param interaction The interaction object from Discord
 * @param env The environment object
 * @returns A promise that resolves to nothing
 *
 * If the user provides a URL to an emoji, it will be uploaded to Discord and
 * the emote will be added to the server.  If the user provides a 7tv link,
 * the bot will fetch the emote from 7tv and upload it to Discord and add it
 * to the server.  If the user provides a raw emoji, the bot will fetch the
 * emoji from Discord and upload it to Discord and add it to the server.
 */
async function handleEmoteCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const add = interaction.data.options.find(option => option.name === 'add')
      if (!add || !('options' in add) || !add.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const emoteOption = add.options.find(option => option.name === 'url_or_emoji')
      if (!emoteOption)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('No emote provided', env)] })
      const emote = 'value' in emoteOption ? emoteOption.value as string : ''

      const is7tvLink = /^https?:\/\/7tv\.app\/emotes\/[a-zA-Z0-9]+$/.test(emote)

      if (emote.startsWith('<a:') || emote.startsWith('<:')) {
        const isAnimated = emote.startsWith('<a:')
        const content = isAnimated ? emote.slice(3, -1) : emote.slice(2, -1)
        const [name, id] = content.split(':')
        let cleanName = name.replace(/[^\w\s]/g, '')
        cleanName = cleanName.padEnd(2, '_').slice(0, 32)
        const extension = isAnimated ? 'gif' : 'png'
        const emoteUrl = `https://cdn.discordapp.com/emojis/${id}.${extension}`

        // Check if the emote already exists in the guild
        try {
          const emojis = await fetchGuildEmojis(interaction.guild_id, env.DISCORD_TOKEN)
          if (emojis.some(emoji => emoji.id === id)) {
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`Emote already exists on this server: <${isAnimated ? 'a' : ''}:${cleanName}:${id}>`, env)] })
          }
        }
        catch (error) {
          console.error('Error checking if emote already exists:', error)
        }

        try {
          const imageBuffer = await fetchEmoteImageBuffer(emoteUrl)
          const discordEmote = await uploadEmoji(interaction.guild_id, env.DISCORD_TOKEN, cleanName, imageBuffer)
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`Emote added: <${isAnimated ? 'a' : ''}:${cleanName}:${discordEmote.id}>`, env)] })
        }
        catch (error) {
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`${error}`, env)] })
        }
      }

      if (is7tvLink) {
        const emoteUrl = emote
        const match = emoteUrl.match(/(?:https?:\/\/)?7tv\.app\/emotes\/([a-zA-Z0-9]+)/)
        const emoteId = match ? match[1] : null

        if (emoteId) {
          try {
            const emote = await fetchSingular7tvEmote(emoteId)
            let cleanName = emote.name.replace(/[^\w\s]/g, '')
            cleanName = cleanName.padEnd(2, '_').slice(0, 32)
            const imageBuffer = await fetch7tvEmoteImageBuffer(emote)
            const discordEmote = await uploadEmoji(interaction.guild_id, env.DISCORD_TOKEN, cleanName, imageBuffer)
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`Emote added: <:${cleanName}:${discordEmote.id}>`, env)] })
          }
          catch (error) {
            return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`${error}`, env)] })
          }
        }
      }
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
    }
    case 'help': {
      const helpCard = {
        type: 17,
        accent_color: 0xFFF200,
        components: [
          {
            type: 9,
            components: [
              {
                type: 10,
                content: '# 🥳 Emote Command Help',
              },
              {
                type: 10,
                content: EMOTE_HELP_MESSAGE,
              },
            ],
            accessory: {
              type: 11,
              media: {
                url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
              },
            },
          },
        ],
      } satisfies APIMessageTopLevelComponent
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { components: [helpCard], flags: 1 << 15 })
    }
  }

  return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid command', env)] })
}

export default {
  command: EMOTE_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
