import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { getKickStatus } from '../../kick/kick'
import { getTwitchStatus } from '../../twitch/twitch'
import { DINKDONK_EMOTE } from '../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const HEALTHCHECK_COMMAND = {
  name: 'healthcheck',
  description: 'Check the health of the bot',
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
}

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleHealthCheckCommand(interaction, env))
  return interactionEphemeralLoading()
}

async function handleHealthCheckCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (interaction.guild_id !== env.DISCORD_GUILD_ID)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in the correct server', env)] })
  let kvStatus = '❌'
  try {
    const kvTest = await env.KV.get('twitch-token')
    kvStatus = kvTest !== null ? '✅' : '❌'
  }
  catch (error) {
    kvStatus = '❌'
    console.error('Error fetching KV status', error)
  }

  let dbStatus = '❌'
  try {
    await env.DB.prepare('SELECT 1').all()
    dbStatus = '✅'
  }
  catch (error) {
    dbStatus = '❌'
    console.error('Error fetching database status', error)
  }

  let twitchStatus = '❌'
  try {
    const res = await getTwitchStatus(env)
    twitchStatus = res.ok ? '✅' : '❌'
  }
  catch (error) {
    twitchStatus = '❌'
    console.error('Error fetching twitch status', error)
  }

  let kickStatus = '❌'
  try {
    const res = await getKickStatus(env)
    kickStatus = res.ok ? '✅' : '❌'
  }
  catch (error) {
    kickStatus = '❌'
    console.error('Error fetching kick status', error)
  }

  let discordStatus = '❌'
  try {
    const res = await fetch(`https://discord.com/api/v10/users/@me`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
    })
    discordStatus = res.ok ? '✅' : '❌'
    if (!res.ok)
      throw new Error(`Failed to fetch discord status: ${JSON.stringify(await res.json())}`)
  }
  catch (error) {
    discordStatus = '❌'
    console.error('Error fetching discord status', error)
  }

  const content = `- KV: ${kvStatus}
- Database: ${dbStatus}
- Twitch API: ${twitchStatus}
- Kick API: ${kickStatus}
- Discord API: ${discordStatus}
`
  return updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(content, env, { title: `${DINKDONK_EMOTE.formatted} Healthcheck`, color: 0xFFF200 })] })
}

export default {
  command: HEALTHCHECK_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
