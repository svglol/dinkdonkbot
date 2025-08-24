import type { APIApplicationCommandInteraction, APIMessageComponentInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { updateInteraction } from '../discord'
import { deferedUpdate, interactionEphemeralLoading } from '../interactionHandler'
import { EMOTE_HELP_MESSAGE } from './emote'
import { KICK_HELP_MESSAGE } from './kick'
import { TWITCH_HELP_MESSAGE } from './twitch'
import { CLIPS_HELP_MESSAGE } from './twitchClips'

const HELP_COMMAND = {
  name: 'help',
  description: 'Show help for DinkDonk Bot',
}

const helpPages: Record<string, string> = {
  page_index: `## 📖 Help Overview
### <:twitch:1404661243373031585> Twitch Stream Alerts
Get notifications when Twitch streamers go live or offline. Includes add, edit, remove, list, test, details, and help commands.
### <:kick:1404661261030916246> Kick Stream Alerts
Get notifications when Kick streamers go live or offline. Includes add, edit, remove, list, test, details, and help commands.
### 📺 Multistream Alerts
If you subscribe to a Twitch and Kick streamer of the same name and in the same discord channel, they will be merged into one message to help reduce spam.
### <a:CLIPPERS:1357111588644982997> Twitch Clip Alerts
Get notifications for Twitch clips from your favorite streamers. Includes add, remove, edit, list, and help commands.
### 🥳 Emote Management
Manage emotes in your server. Add emotes from other servers or 7tv, and use the context menu to steal emotes.
### 🎉 Misc Commands
Various utility commands to help you interact with the bot, including time, weather, invites, fun interactions, and generating timestamps.
### ❓ Support
Links to the website, GitHub repository, and ways to support the bot.`,
  page_twitch: `## <:twitch:1404661243373031585> **Twitch Stream Alerts**
${TWITCH_HELP_MESSAGE}`,
  page_kick: `## <:kick:1404661261030916246> **Kick Stream Alerts**
${KICK_HELP_MESSAGE}`,
  page_clips: `## <a:CLIPPERS:1357111588644982997> **Twitch Clips**
${CLIPS_HELP_MESSAGE}`,
  page_emotes: `## 🥳 **Emote Management**
${EMOTE_HELP_MESSAGE}`,
  page_misc: `## 🎉 **Misc Commands**
- </help:1404682388671430707> - Show this help message
- </invite:1227872472049782918> - Generate an invite link to add DinkDonk Bot to another Discord server
- </time:1405377555464196206> - Get the current time for a location
- </weather:1405377555464196207> - Get the current weather for a location
- </timestamp:1405390830742671433> - Create a Discord timestamp for a specific date/time and UTC offset
- </dinkdonk:1348444759286353951> - Get DinkDonked
- </randomemote:1405395336763019335> - Post a random emote from your server
- </coinflip:1407262584649814066> - Flip a coin
- </rps:1407312970903457903> - Play a game of rock, paper, scissors against another user
- </roll:1407494568366047252> - Roll dice
- </hangman:1407585217257934929> - Play a game of hangman with the community`,
  page_support: `## ❓ Support

Need help or want to support DinkDonk Bot? Here’s where to go:

The fastest way to get assistance is on **[Discord](https://discord.gg/NuY7Tnrb6F)**.

🔗 Useful Links:  
- [Join Discord](https://discord.gg/NuY7Tnrb6F)  
- [Official Website](https://svglol.github.io/dinkdonkbot/)  
- [GitHub Repository](https://github.com/svglol/dinkdonkbot)
`,
}

/** ***********  ✨ Windsurf Command ⭐  */
/**
 * Handles the /help command.
 *
 * @param interaction - The interaction to handle
 * @param env - The environment to use
 * @param ctx - The context to use
 */
/** *****  f3346a23-0c7b-4c01-8a0f-61562a0cd671  */
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
          { label: 'Twitch Alerts', value: 'page_twitch', emoji: { id: '1404661243373031585', name: 'twitch' } },
          { label: 'Kick Alerts', value: 'page_kick', emoji: { id: '1404661261030916246', name: 'kick' } },
          { label: 'Twitch Clips', value: 'page_clips', emoji: { id: '1357111588644982997', name: 'CLIPPERS' } },
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
          name: 'Discord',
          id: '1408714772794310686',
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
          name: 'GitHub',
          id: '1408716639268241491',
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
