import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { buildErrorEmbed, findBotCommandMarkdown, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { CLIPPERS_EMOTE, KICK_EMOTE, TWITCH_EMOTE } from '@/utils/discordEmotes'

export const CLIPS_HELP_COMMAND = {
  type: 1,
  name: 'help',
  description: 'Show help for the clips commands',
  dm_permission: false,
}

export async function getClipsHelpMessage(env: Env) {
  return `Subscribe to automatic Twitch && KICK clip notifications from your favorite streamers. Get the best clips posted hourly to your Discord channels.
  
${TWITCH_EMOTE.formatted} **Twitch Clips**
- ${await findBotCommandMarkdown(env, 'clips', 'twitch', 'add')} <streamer> <discord-channel> - Add a Twitch streamer to receive hourly clip updates.  
- ${await findBotCommandMarkdown(env, 'clips', 'twitch', 'remove')} <streamer> - Remove a Twitch streamer from receiving clip notifications.
- ${await findBotCommandMarkdown(env, 'clips', 'twitch', 'edit')} <streamer> <discord-channel> - Edit the notification channel for a Twitch streamer.
- ${await findBotCommandMarkdown(env, 'clips', 'twitch', 'list')} - List all the Twitch streamers you are subscribed to for clip notifications.

${KICK_EMOTE.formatted} **Kick Clips (BETA)**
- ${await findBotCommandMarkdown(env, 'clips', 'kick', 'add')} <streamer> <discord-channel> - Add a Kick streamer to receive hourly clip updates.  
- ${await findBotCommandMarkdown(env, 'clips', 'kick', 'remove')} <streamer> - Remove a Kick streamer from receiving clip notifications.
- ${await findBotCommandMarkdown(env, 'clips', 'kick', 'edit')} <streamer> <discord-channel> - Edit the notification channel for a Kick streamer.
- ${await findBotCommandMarkdown(env, 'clips', 'kick', 'list')} - List all the Kick streamers you are subscribed to for clip notifications.

**Command variables**
> \`<streamer>\` – The name of the streamer to add  
> \`<discord-channel>\` – The Discord channel to post to when the streamer goes live`
}

export async function handleClipsHelpCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataOption, env: Env) {
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  if (command.type !== ApplicationCommandOptionType.Subcommand)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

  const helpCard = {
    type: 17,
    accent_color: 0xFFF200,
    components: [
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `# ${CLIPPERS_EMOTE.formatted} Available Commands for Clip Notifications`,
          },
          {
            type: 10,
            content: await getClipsHelpMessage(env),
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
  return await updateInteraction(interaction, env, { components: [helpCard], flags: 1 << 15 })
}
