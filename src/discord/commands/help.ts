import type { APIApplicationCommandInteraction, APIMessageComponentInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { CLIPPERS_EMOTE, DISCORD_EMOTE, GITHUB_EMOTE, KICK_EMOTE, TWITCH_EMOTE } from '../../util/discordEmotes'
import { findBotCommandMarkdown, updateInteraction } from '../discord'
import { deferedUpdate, interactionEphemeralLoading } from '../interactionHandler'
import { getEmoteHelpMessage } from './emote'
import { getKickHelpMessage } from './stream/kick/help'
import { getMultistreamHelpMessage } from './stream/multistream/help'
import { getTwitchHelpMessage } from './stream/twitch/help'
import { getClipsHelpMessage } from './twitchClips'

const HELP_COMMAND = {
  name: 'help',
  description: 'Show help for DinkDonk Bot',
}

async function getHelpPages(env: Env): Promise<Record<string, string>> {
  return {
    page_index: `## 📖 Help Overview
### 🚀 Quickstart
Use the ${await findBotCommandMarkdown(env, 'quickstart')} command to set up the bot and notifications in a few easy steps. Perfect for new users who want a guided setup.
### ${TWITCH_EMOTE.formatted} Twitch Stream Alerts
Set up Twitch stream notifications for your Discord server. Get notified when your favorite streamers go live or offline with customizable messages and ping roles.
### ${KICK_EMOTE.formatted} Kick Stream Alerts  
Set up Kick stream notifications for your Discord server. Get notified when your favorite streamers go live or offline with customizable messages and ping roles.
### 📺 Multistream Alerts
Combine Twitch and Kick notifications into unified alerts. Perfect for streamers who multistream across both platforms.
### ${CLIPPERS_EMOTE.formatted} Twitch Clip Alerts
Subscribe to automatic Twitch clip notifications from your favorite streamers. Get the best clips posted hourly to your Discord channels.
### 🥳 Emote Management
Easily add custom emotes to your Discord server from other servers or 7tv. Steal emotes from messages or add them directly by URL or emoji.
### 🎉 Misc Commands
Various utility commands including time, weather, invites, fun interactions, and timestamp generation.
### ❓ Support
Links to the website, GitHub repository, and ways to support the bot.`,
    page_twitch: `## ${TWITCH_EMOTE.formatted} **Twitch Stream Alerts**
${await getTwitchHelpMessage(env)}`,
    page_kick: `## ${KICK_EMOTE.formatted} **Kick Stream Alerts**
${await getKickHelpMessage(env)}`,
    page_multistream: `## 📺 **Multistream Alerts**
${await getMultistreamHelpMessage(env)}`,
    page_clips: `## ${CLIPPERS_EMOTE.formatted} **Twitch Clips**
${await getClipsHelpMessage(env)}`,
    page_emotes: `## 🥳 **Emote Management**
${await getEmoteHelpMessage(env)}`,
    page_misc: `## 🎉 **Misc Commands**
- ${await findBotCommandMarkdown(env, 'help')} - Show this help message
- ${await findBotCommandMarkdown(env, 'invite')} - Generate an invite link to add DinkDonk Bot to another Discord server
- ${await findBotCommandMarkdown(env, 'time')} - Get the current time for a location
- ${await findBotCommandMarkdown(env, 'weather')} - Get the current weather for a location
- ${await findBotCommandMarkdown(env, 'timestamp')} - Create a Discord timestamp for a specific date/time and UTC offset
- ${await findBotCommandMarkdown(env, 'dinkdonk')} - Get DinkDonked
- ${await findBotCommandMarkdown(env, 'randomemote')} - Post a random emote from your server
- ${await findBotCommandMarkdown(env, 'coinflip')} - Flip a coin
- ${await findBotCommandMarkdown(env, 'rps')} - Play a game of rock, paper, scissors against another user
- ${await findBotCommandMarkdown(env, 'roll')} - Roll dice
- ${await findBotCommandMarkdown(env, 'hangman')} - Play a game of hangman with the community`,
    page_support: `## ❓ Support

Need help or want to support DinkDonk Bot? Here’s where to go:

The fastest way to get assistance is on **[Discord](https://discord.gg/NuY7Tnrb6F)**.

🔗 Useful Links:  
- [Join Discord](https://discord.gg/NuY7Tnrb6F)  
- [Official Website](https://svglol.github.io/dinkdonkbot/)  
- [GitHub Repository](https://github.com/svglol/dinkdonkbot)`,
  }
}

/**
 * Handles the /help command.
 *
 * @param interaction - The interaction to handle
 * @param env - The environment to use
 * @param ctx - The context to use
 */
function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleHelpCommand(interaction, env))
  return interactionEphemeralLoading()
}

async function handleHelpCommand(interaction: APIMessageComponentInteraction | APIApplicationCommandInteraction, env: Env, page: string = 'page_index') {
  const buttonsRow: APIMessageTopLevelComponent = {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: 'help_page_select',
        placeholder: 'Select a help page',
        options: [
          { label: 'Overview', value: 'page_index', emoji: { name: '📖' } },
          { label: 'Twitch Alerts', value: 'page_twitch', emoji: { id: TWITCH_EMOTE.id, name: TWITCH_EMOTE.name } },
          { label: 'Kick Alerts', value: 'page_kick', emoji: { id: KICK_EMOTE.id, name: KICK_EMOTE.name } },
          { label: 'Multistream Alerts', value: 'page_multistream', emoji: { name: '📺' } },
          { label: 'Twitch Clips', value: 'page_clips', emoji: { id: CLIPPERS_EMOTE.id, name: CLIPPERS_EMOTE.name } },
          { label: 'Emote Management', value: 'page_emotes', emoji: { name: '🥳' } },
          { label: 'Misc Commands', value: 'page_misc', emoji: { name: '🎉' } },
          { label: 'Support', value: 'page_support', emoji: { name: '❓' } },
        ],
      },
    ],
  }

  const actionButtons: APIMessageTopLevelComponent = {
    type: 1,
    components: [
      {
        type: 2,
        label: 'Discord Server',
        url: 'https://discord.gg/NuY7Tnrb6F',
        style: 5,
        emoji: {
          name: DISCORD_EMOTE.name,
          id: DISCORD_EMOTE.id,
        },
      },
      {
        type: 2,
        label: 'Documentation',
        url: 'https://svglol.github.io/dinkdonkbot/',
        style: 5,
        emoji: {
          name: '🌐',
        },
      },
      {
        type: 2,
        label: 'GitHub',
        url: 'https://github.com/svglol/dinkdonkbot',
        style: 5,
        emoji: {
          name: GITHUB_EMOTE.name,
          id: GITHUB_EMOTE.id,
        },
      },
      {
        type: 2,
        label: 'Support Me',
        url: 'https://ko-fi.com/svglol',
        style: 5,
        emoji: {
          name: '💖',
        },
      },
    ],
  }

  const helpPages = await getHelpPages(env)
  const helpCard = {
    type: 17,
    accent_color: 0xFFF200,
    components: [
      {
        type: 9,
        components: [
          {
            type: 10,
            content: '# DinkDonk Bot Help',
          },
          {
            type: 10,
            content: helpPages[page] || 'Select a page from the dropdown below.',
          },
        ],
        accessory: {
          type: 11,
          media: {
            url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
          },
        },
      },

      buttonsRow,
    ],
  } satisfies APIMessageTopLevelComponent

  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
    flags: 1 << 15,
    components: [helpCard, actionButtons],
  })
}

async function handleMessageComponent(interaction: APIMessageComponentInteraction, env: Env, ctx: ExecutionContext) {
  const selectedPage = interaction.data.component_type === 3 ? interaction.data.values?.[0] : undefined
  const page = selectedPage ?? 'page_index'
  ctx.waitUntil(handleHelpCommand(interaction, env, page))

  return deferedUpdate()
}

export default { command: HELP_COMMAND, handler, messageComponentHandlers: { help_page_select: handleMessageComponent } } satisfies DiscordAPIApplicationCommand
