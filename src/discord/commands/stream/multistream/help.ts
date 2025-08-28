import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { findBotCommandMarkdown, updateInteraction } from '../../../discord'

export const MULTISTREAM_HELP_COMMAND = {
  type: 1,
  name: 'help',
  description: 'Show help for the multistream command',
  dm_permission: false,
}

export async function getMultistreamHelpMessage(env: Env) {
  return `
    Do you or the streamer you follow broadcast to both Twitch and Kick at the same time? You can link the streams so the bot combines notifications into a single message whenever possible, cutting down on spam.
    
    To use this feature:
    - Both Twitch and Kick alerts need to be set up.
    - Make sure both are configured to post to the same Discord channel.
    - When one stream goes live, the bot will wait up to 15 seconds for the other to start before sending a notification.
    - You can set a priority to decide which platform’s data the message should use first.
    - With the late merge option on, the bot will always try to merge notifications even if one of the streams goes live after the 15 second grace period.
    
    **Multistream commands**
    - ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'link')} - <twitch-streamer> <kick-streamer> <priority> <late-merge> - Setup a multistream connection between a Twitch & Kick Channel
    - ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'unlink')} - <twitch-streamer> <kick-streamer> - Remove a multistream connection between a Twitch & Kick Channel
    - ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'edit')} <twitch-streamer> <kick-streamer> <priority> <late-merge> - Edit a multistream connection
    - ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'list')} - List your currently set up multistreams
    - ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'help')} - Show help for the multistream command
    
    **Command variables**
    > \`<twitch-streamer>\` - The name of the Twitch streamer to add (you must already have a Twitch Alert setup)
    > \`<kick-streamer>\` - The name of the Kick streamer to add (you must already have a Kick Alert setup)
    > \`<priority>\` - Which platforms data should be used first in embeds (Twitch or Kick)
    > \`<late-merge>\`- If one of the multistreams goes live after the 15 second delay, still merge the notifications.
    `
}

export async function handleMultistreamHelpCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const helpCard = {
    type: 17,
    accent_color: 0xFFF200,
    components: [
      {
        type: 9,
        components: [
          {
            type: 10,
            content: '# 📺 Multistream Help',
          },
          {
            type: 10,
            content: await getMultistreamHelpMessage(env),
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
