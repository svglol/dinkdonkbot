import type { APIApplicationCommandInteraction, RESTGetAPICurrentUserGuildsResult } from 'discord-api-types/v10'
import { useDB } from '@database'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '@discord-api'
import { REST } from '@discordjs/rest'
import { getKickSubscriptions } from '@kick-api'
import { getSubscriptions } from '@twitch-api'
import { PermissionFlagsBits, Routes } from 'discord-api-types/v10'
import { interactionEphemeralLoading } from '@/discord/interactionHandler'
import { DINKDONK_EMOTE } from '@/utils/discordEmotes'

const STATS_COMMAND = {
  name: 'stats',
  description: 'Show stats for the bot',
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
}
function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleStatsCommand(interaction, env))
  return interactionEphemeralLoading()
}

async function handleStatsCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (interaction.guild_id !== env.DISCORD_GUILD_ID)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in the correct server', env)] })

  const rest = new REST({ version: '10', api: `${env.DISCORD_PROXY}/api`, makeRequest: fetch.bind(globalThis) as any }).setToken(env.DISCORD_TOKEN)
  const db = useDB(env)

  // Run all async operations concurrently
  const [
    guilds,
    streams,
    kickStreams,
    clips,
    multistreams,
    twitchSubscriptions,
    kickSubscriptions,
  ] = await Promise.all([
    rest.get(Routes.userGuilds()) as Promise<RESTGetAPICurrentUserGuildsResult>,
    db.query.streams.findMany(),
    db.query.kickStreams.findMany(),
    db.query.clips.findMany(),
    db.query.multiStream.findMany(),
    getSubscriptions(env),
    getKickSubscriptions(env),
  ])

  const serverCount = guilds.length
  const streamCount = streams.length
  const kickStreamCount = kickStreams.length
  const clipCount = clips.length
  const multistreamCount = multistreams.length

  const uniqueTwitchSubscriptions = new Set(twitchSubscriptions?.data
    .filter(sub => sub.status === 'enabled')
    .map(sub => sub.condition.broadcaster_user_id),
  )
  const uniqueKickSubscriptions = new Set(kickSubscriptions?.data
    .map(sub => sub.broadcaster_user_id),
  )

  const content = `
- Connected Discord Servers: ${serverCount}
- Stored Twitch Streams (DB): ${streamCount}
- Active Twitch Webhook Subscriptions (API): ${uniqueTwitchSubscriptions.size}
- Twitch Subscriptions Total Cost (API): ${twitchSubscriptions?.total_cost}
- Stored Kick Streams (DB): ${kickStreamCount}
- Active Kick Webhook Subscriptions (API): ${uniqueKickSubscriptions.size}
- Stored Clips (DB): ${clipCount}
- Stored Multistream Configurations (DB): ${multistreamCount}
`

  return updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(content, env, { title: `${DINKDONK_EMOTE.formatted} Stats`, color: 0xFFF200 })] })
}

export default {
  command: STATS_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
