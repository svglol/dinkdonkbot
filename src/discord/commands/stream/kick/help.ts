import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataSubcommandOption, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { KICK_EMOTE } from '../../../../util/discordEmotes'
import { findBotCommandMarkdown, updateInteraction } from '../../../discord'

export const KICK_HELP_COMMAND = {
  type: 1,
  name: 'help',
  description: 'Show help for the kick command',
  dm_permission: false,
}

export async function handleKickHelpCommand(interaction: APIApplicationCommandInteraction, command: APIApplicationCommandInteractionDataSubcommandOption, env: Env) {
  const helpCard = {
    type: 17,
    accent_color: 0xFFF200,
    components: [
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `# ${KICK_EMOTE.formatted} Available commands`,
          },
          {
            type: 10,
            content: await getKickHelpMessage(env),
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

export async function getKickHelpMessage(env: Env) {
  return `Set up Kick stream notifications for your Discord server. Get notified when your favorite streamers go live or offline with customizable messages and ping roles.
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'add')} <streamer> <discord-channel> <ping-role> <live-message> <offline-message> <cleanup> - Add a Kick streamer to receive notifications for going online or offline
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'edit')} <streamer> <discord-channel> <ping-role> <live-message> <offline-message> <cleanup> - Edit a Kick streamer’s settings  
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'remove')} <streamer> - Remove a Kick streamer from receiving notifications for going online or offline  
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'list')} - List the Kick streamers that you are subscribed to  
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'test')} <streamer> <global> <message-type> <multistream> - Test the notification for a streamer
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'details')} <streamer> - Show the details for a streamer you are subscribed to  
- ${await findBotCommandMarkdown(env, 'stream', 'kick', 'help')} - Get this help message  

**Command variables**
> \`<streamer>\` – The name of the streamer to add  
> \`<discord-channel>\` – The Discord channel to post to when the streamer goes live  
> \`<ping-role>\` – What role to @ when the streamer goes live
 > \`<remove-ping-role>\` – Remove the current ping role (only in edit mode)    
> \`<live-message>\` – The message to post when the streamer goes live  
> \`<offline-message>\` – The message to post when the streamer goes offline  
> \`<cleanup>\` – Delete notifications once the streamer goes offline  
> \`<message-type>\` - Whether to test the live or offline message
> \`<multistream>\` - Show the notification as if it was a multistream (only works if you have a multistream setup)
> \`<global>\` - Show the notification for everyone in the server

**Message variables**  
> \`{{name}}\` = the name of the streamer
> \`{{url}}\` = the url for the stream
> \`{{everyone}}\` = @everyone
> \`{{here}}\` = @here
> \`{{game}}/{{category}}\` = the game or category of the stream (live only)
> \`{{timestamp}}\` = the time the stream started/ended
`
}
