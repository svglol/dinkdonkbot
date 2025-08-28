import type { APIApplicationCommandInteraction, APIMessageComponentInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../../util/discordEmotes'
import { findBotCommandMarkdown, updateInteraction } from '../../discord'
import { deferedUpdate } from '../../interactionHandler'

export const STREAM_HELP_COMMAND = {
  type: 1,
  name: 'help',
  description: 'Show help for the stream command',
  dm_permission: false,
}

async function getHelpPages(env: Env): Promise<Record<string, string>> {
  return {
    page_index: `## 📖 Overview
### ${TWITCH_EMOTE.formatted} Twitch Stream Alerts
Set up Twitch stream notifications for your Discord server. Get notified when your favorite streamers go live with customizable messages and ping roles.
### ${KICK_EMOTE.formatted} Kick Stream Alerts  
Set up Kick stream notifications for your Discord server. Get notified when your favorite streamers go live with customizable messages and ping roles.
### 📺 Multistream Alerts
Combine Twitch and Kick notifications into unified alerts. Perfect for streamers who multistream across both platforms.`,
    page_twitch: `## ${TWITCH_EMOTE.formatted} **Twitch Stream Alerts**
Set up Twitch stream notifications for your Discord server. Get notified when your favorite streamers go live or offline with customizable messages and ping roles.
- ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'add')} <streamer> <discord-channel> <ping-role> <live-message> <offline-message> <cleanup> - Add a Twitch streamer to receive notifications for going online or offline
- ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'edit')} <streamer> <discord-channel> <ping-role> <live-message> <offline-message> <cleanup> - Edit a Twitch streamer’s settings  
- ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'remove')} <streamer> - Remove a Twitch streamer from receiving notifications for going online or offline  
- ${await findBotCommandMarkdown(env, 'stream', 'list')} - List the Twitch streamers that you are subscribed to  
- ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'test')} <streamer> <message-type> <multistream> <global> - Test the notification for a streamer
- ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'details')} <streamer> - Show the details for a streamer you are subscribed to  

**Command Parameters**
> \`<streamer>\` – The name of the streamer to add  
> \`<discord-channel>\` – The Discord channel to post to when the streamer goes live  
> \`<ping-role>\` – What role to @ when the streamer goes live
> \`<remove-ping-role>\` – Remove the current ping role (only in edit mode)  
> \`<live-message>\` – The message to post when the streamer goes live  
> \`<offline-message>\` – The message to post when the streamer goes offline  
> \`<cleanup>\` – Delete notifications once the streamer goes offline
> \`<message-type>\` – Whether to test the live or offline message
> \`<multistream>\` – Show the notification as if it was a multistream (only works if you have a multistream setup)
> \`<global>\` – Show the notification for everyone in the server  `,
    page_kick: `## ${KICK_EMOTE.formatted} **Kick Stream Alerts**
Set up Kick stream notifications for your Discord server. Get notified when your favorite streamers go live or offline with customizable messages and ping roles.
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'add')} <streamer> <discord-channel> <ping-role> <live-message> <offline-message> <cleanup> - Add a Kick streamer to receive notifications for going online or offline
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'edit')} <streamer> <discord-channel> <ping-role> <live-message> <offline-message> <cleanup> - Edit a Kick streamer’s settings  
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'remove')} <streamer> - Remove a Kick streamer from receiving notifications for going online or offline  
- ${await findBotCommandMarkdown(env, 'stream', 'list')} - List the Kick streamers that you are subscribed to  
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'test')} <streamer> <global> <message-type> <multistream> - Test the notification for a streamer
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'details')} <streamer> - Show the details for a streamer you are subscribed to  

**Command Parameters**
> \`<streamer>\` – The name of the streamer to add  
> \`<discord-channel>\` – The Discord channel to post to when the streamer goes live  
> \`<ping-role>\` – What role to @ when the streamer goes live
 > \`<remove-ping-role>\` – Remove the current ping role (only in edit mode)    
> \`<live-message>\` – The message to post when the streamer goes live  
> \`<offline-message>\` – The message to post when the streamer goes offline  
> \`<cleanup>\` – Delete notifications once the streamer goes offline  
> \`<message-type>\` - Whether to test the live or offline message
> \`<multistream>\` - Show the notification as if it was a multistream (only works if you have a multistream setup)
> \`<global>\` - Show the notification for everyone in the server`,
    page_multistream: `## 📺 **Multistream Alerts**
 Do you or the streamer you follow broadcast to both Twitch and Kick at the same time? You can link the streams so the bot combines notifications into a single message whenever possible, cutting down on spam.
    
To use this feature:
- Both Twitch and Kick alerts need to be set up.
- Make sure both are configured to post to the same Discord channel.
- When one stream goes live, the bot will wait up to 15 seconds for the other to start before sending a notification.
- You can set a priority to decide which platform’s data the message should use first.
- With the late merge option on, the bot will always try to merge notifications even if one of the streams goes live after the 15 second grace period.
**Multistream Commands**
- ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'link')} - <twitch-streamer> <kick-streamer> <priority> <late-merge> - Setup a multistream connection between a Twitch & Kick Channel
- ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'unlink')} - <twitch-streamer> <kick-streamer> - Remove a multistream connection between a Twitch & Kick Channel
- ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'edit')} <twitch-streamer> <kick-streamer> <priority> <late-merge> - Edit a multistream connection
- ${await findBotCommandMarkdown(env, 'stream', 'list')} - List your currently set up multistreams
 \n
**Command Parameters**
> \`<twitch-streamer>\` - The name of the Twitch streamer to add (you must already have a Twitch Alert setup)
> \`<kick-streamer>\` - The name of the Kick streamer to add (you must already have a Kick Alert setup)
> \`<priority>\` - Which platforms data should be used first in embeds (Twitch or Kick)
> \`<late-merge>\`- If one of the multistreams goes live after the 15 second delay, still merge the notifications.`,
    page_variables: `## 📝 **Message Variables**
In your stream live-message and offline-message, you can use the following variables, which will be replaced with the values from the stream:
> \`{{name}}\` = the name of the streamer
> \`{{url}}\` = the url for the stream
> \`{{everyone}}\` = @everyone
> \`{{here}}\` = @here
> \`{{game}}/{{category}}\` = the game or category of the stream (live only)
> \`{{timestamp}}\` = the time the stream started/ended`,
  }
}

export async function handleStreamHelpCommand(interaction: APIMessageComponentInteraction | APIApplicationCommandInteraction, env: Env, page: string = 'page_index') {
  const buttonsRow: APIMessageTopLevelComponent = {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: 'stream_help_page_select',
        placeholder: 'Select a help page',
        options: [
          { label: 'Overview', value: 'page_index', emoji: { name: '📖' }, default: page === 'page_index' },
          { label: 'Twitch Alerts', value: 'page_twitch', emoji: { id: TWITCH_EMOTE.id, name: TWITCH_EMOTE.name }, default: page === 'page_twitch' },
          { label: 'Kick Alerts', value: 'page_kick', emoji: { id: KICK_EMOTE.id, name: KICK_EMOTE.name }, default: page === 'page_kick' },
          { label: 'Multistream Alerts', value: 'page_multistream', emoji: { name: '📺' }, default: page === 'page_multistream' },
          { label: 'Message Variables', value: 'page_variables', emoji: { name: '📝' }, default: page === 'page_variables' },
        ],
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
            content: '# Stream Alerts Help',
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
    components: [helpCard],
  })
}

export async function handleStreamHelpMessageComponent(interaction: APIMessageComponentInteraction, env: Env, ctx: ExecutionContext) {
  const selectedPage = interaction.data.component_type === 3 ? interaction.data.values?.[0] : undefined
  const page = selectedPage ?? 'page_index'
  ctx.waitUntil(handleStreamHelpCommand(interaction, env, page))

  return deferedUpdate()
}
