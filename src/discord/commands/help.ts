import type { APIApplicationCommandInteraction, APIEmbed, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const HELP_COMMAND = {
  name: 'help',
  description: 'Show help for DinkDonk Bot',
  dm_permission: false,
}

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleHelpCommand(interaction, env))
  return interactionEphemeralLoading()
}

async function handleHelpCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  const embed = {
    title: 'DinkDonk Bot Help',
    description: 'All commands and related information for DinkDonk Bot',
    color: 0xFFF200,
    thumbnail: {
      url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
    fields: [
      {
        name: '<:twitch:1404661243373031585> Twitch Stream Alerts',
        value: 'Use </twitch help:1227872472049782919> to get help for Twitch notifications',
      },
      {
        name: '<:kick:1404661261030916246> Kick Stream Alerts',
        value: 'Use </kick help:1398833401888378910> to get help for Kick notifications',
      },
      {
        name: '📺 Multistream Alerts',
        value: 'If you subscribe to a Twitch and Kick streamer of the same name and in the same discord channel, they will be merged into one message to help reduce spam',
      },
      {
        name: '<a:CLIPPERS:1357111588644982997> Twitch Clips',
        value: 'Use </clips help:1348090120418361426> to get help for Twitch clips notifications',
      },
      {
        name: '🥳 Emote Management',
        value: 'Use </emote help:1348421861339304067> to get help for emote commands',
      },
      {
        name: '❓ Support',
        value: 'If you have any issues open a [GitHub issue](https://github.com/svglol/dinkdonkbot/issues/new/choose).',
      },
      {
        name: '🔗 Links',
        value: '[Website](https://svglol.github.io/dinkdonkbot/) | [GitHub](https://github.com/svglol/dinkdonkbot)',
      },
    ],
    footer: {
      text: 'DinkDonk Bot',
      icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
  } satisfies APIEmbed

  const components: APIMessageTopLevelComponent[] = [
    {
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
    },
  ]
  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [embed], components })
}

export default { command: HELP_COMMAND, handler } satisfies DiscordAPIApplicationCommand
