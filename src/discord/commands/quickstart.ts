import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { DINKDONK_EMOTE, KICK_EMOTE, TWITCH_EMOTE } from '../../util/discordEmotes'
import { buildSuccessEmbed, findBotCommandMarkdown, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const QUICKSTART_COMMAND = {
  name: 'quickstart',
  description: 'Get started with DinkDonk Bot',
}

export async function buildQuickstartMessage(env: Env) {
  const twitchAddCommand = await findBotCommandMarkdown(env, 'streams', 'twitch', 'add')
  const kickAddCommand = await findBotCommandMarkdown(env, 'streams', 'kick', 'add')
  const twitchTestCommand = await findBotCommandMarkdown(env, 'streams', 'twitch', 'test')
  const kickTestCommand = await findBotCommandMarkdown(env, 'streams', 'kick', 'test')
  const multistreamCommand = await findBotCommandMarkdown(env, 'streams', 'multistream', 'link')
  const helpCommand = await findBotCommandMarkdown(env, 'help')
  const clipsCommand = await findBotCommandMarkdown(env, 'clips', 'twitch', 'add')
  const emoteCommand = await findBotCommandMarkdown(env, 'emote', 'add')
  const streamHelpCommand = await findBotCommandMarkdown(env, 'streams', 'help')

  const message = `Welcome! Let's get you set up with stream notifications in 3 easy steps.
### Step 1: Add a Streamer
Add a Twitch or Kick streamer and choose which channel to post notifications in.  
${TWITCH_EMOTE.formatted} Twitch: ${twitchAddCommand}  
${KICK_EMOTE.formatted} Kick: ${kickAddCommand}
### Step 2: Multistream Notifications
Link Twitch & Kick streamers together to combine notifications into one, reducing spam.  
-# Note: You must have both Twitch and Kick notifications set up for this to work, and both need to be configured to post to the same channel.
${multistreamCommand}
### Step 3: Test Your Notification (Optional)
Send a test notification to preview how your notifications will look.  
${twitchTestCommand}  
${kickTestCommand}
### Step 4: Explore More Features
Enhance your server with extra tools and fun commands.  
- Twitch Clips: Get hourly highlights with ${clipsCommand} 
- Emotes: Add emotes from other servers or 7tv with ${emoteCommand} 
### Need Help?
If you get stuck, use ${helpCommand} or ${streamHelpCommand} for more details or join our [Discord server](https://discord.gg/NuY7Tnrb6F) for support!

-# Note: /streams and /clips commands are only available to use in servers, not DMs.`

  return message
}

/**
 * Handles the /quickstart command.
 * @param interaction The interaction object from Discord
 * @param env The environment object containing configuration and authentication details.
 * @param ctx The context object from Cloudflare
 * @returns A promise that resolves to nothing. Updates the interaction with a quickstart guide.
 */
async function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  const message = await buildQuickstartMessage(env)
  ctx.waitUntil(
    updateInteraction(interaction, env, {
      embeds: [buildSuccessEmbed(message, env, { title: `${DINKDONK_EMOTE.formatted} DinkDonk Bot Quickstart`, color: 0xFFF200 })],
    }),
  )

  return interactionEphemeralLoading()
}

export default {
  command: QUICKSTART_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
