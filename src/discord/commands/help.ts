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
  dm_permission: false,
}

const helpPages: Record<string, string> = {
  page_index: `## Help Overview
### <:twitch:1404661243373031585> Twitch Stream Alerts
Get notifications when Twitch streamers go live or offline. Includes add, edit, remove, list, test, details, and help commands.
### <:kick:1404661261030916246> Kick Stream Alerts
Get notifications when Kick streamers go live or offline. Includes add, edit, remove, list, test, details, and help commands.
### 📺 Multistream Alerts
If you subscribe to a Twitch and Kick streamer of the same name and in the same discord channel, they will be merged into one message to help reduce spam
### <a:CLIPPERS:1357111588644982997> Twitch Clip Alerts
Get notifications for Twitch clips from your favorite streamers. Includes add, remove, edit, list, and help commands.
### 🥳 Emote Management
Manage emotes in your server. Add emotes from other servers or 7tv, and use the context menu to steal emotes.
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
  page_support:
`## ❓ **Support**
If you have any issues, open a [GitHub issue](https://github.com/svglol/dinkdonkbot/issues/new/choose).
    
🔗 Links: [Website](https://svglol.github.io/dinkdonkbot/) | [GitHub](https://github.com/svglol/dinkdonkbot)`,
}

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
          { label: 'Overview', value: 'page_index' },
          { label: 'Twitch Alerts', value: 'page_twitch' },
          { label: 'Kick Alerts', value: 'page_kick' },
          { label: 'Twitch Clips', value: 'page_clips' },
          { label: 'Emote Management', value: 'page_emotes' },
          { label: 'Support', value: 'page_support' },
        ],
      },
    ],
  }

  const actionButtons: APIMessageTopLevelComponent = {
    type: 1,
    components: [
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
          name: '🐙',
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
