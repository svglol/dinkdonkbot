import type { APIApplicationCommandInteraction, RESTGetAPICurrentUserGuildsResult } from 'discord-api-types/v10'
import { REST } from '@discordjs/rest'
import { PermissionFlagsBits, Routes } from 'discord-api-types/v10'
import { useDB } from '../../database/db'
import { DINKDONK_EMOTE } from '../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

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
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in the correct server', env)] })
  // number of guilds
  const rest = new REST({ version: '10', makeRequest: fetch.bind(globalThis) as any }).setToken(env.DISCORD_TOKEN)
  const guilds = await rest.get(Routes.userGuilds()) as RESTGetAPICurrentUserGuildsResult
  const serverCount = guilds.length

  // twitch
  const streams = await useDB(env).query.streams.findMany()
  const streamCount = streams.length
  // kick
  const kickStreams = await useDB(env).query.kickStreams.findMany()
  const kickStreamCount = kickStreams.length
  // clips
  const clips = await useDB(env).query.clips.findMany()
  const clipCount = clips.length
  // multistreams
  const multistreams = await useDB(env).query.multiStream.findMany()
  const multistreamCount = multistreams.length

  const content = `
- Discord Server count: ${serverCount}
- Twitch Stream count: ${streamCount}
- Kick Stream count: ${kickStreamCount}
- Clip count: ${clipCount}
- Multistream count: ${multistreamCount}
 `

  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(content, env, { title: `${DINKDONK_EMOTE.formatted} Stats`, color: 0xFFF200 })] })
}

export default {
  command: STATS_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
