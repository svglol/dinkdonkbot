import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { DINKDONK_EMOTE } from '../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const COMMANDUSAGE_COMMAND = {
  name: 'commandusage',
  description: 'Show stats for commands',
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
  options: [
    {
      name: 'days',
      description: 'Time period to show stats for',
      type: 4,
      required: false,
      choices: [
        { name: '1 day', value: 1 },
        { name: '7 days', value: 7 },
        { name: '14 days', value: 14 },
        { name: '30 days', value: 30 },
      ],
    },
  ],
}

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleUsageCommand(interaction, env))
  return interactionEphemeralLoading()
}

async function handleUsageCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (interaction.guild_id !== env.DISCORD_GUILD_ID)
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in the correct server', env)] })
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  // Get the days parameter, default to 7 days - options can be undefined for commands with all optional parameters
  const daysOption = interaction.data.options?.find(option => option.name === 'days')
  const days = daysOption && 'value' in daysOption ? daysOption.value as number : 7

  try {
    // Query Analytics Engine for command usage stats
    const usageStats = await getCommandUsageStats(env, days)

    if (usageStats.length === 0) {
      return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
        embeds: [buildErrorEmbed('No command usage stats found', env)],
      })
    }

    // Format the response
    const response = formatUsageStats(usageStats, days)

    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [buildSuccessEmbed(response, env, { title: `${DINKDONK_EMOTE.formatted} Command Usage Stats`, color: 0xFFF200 })],
    })
  }
  catch (error) {
    console.error('Error getting command usage stats:', error)
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [buildErrorEmbed(`Error getting command usage stats` + `\n${error}`, env)],
    })
  }
}

async function getCommandUsageStats(env: Env, days: number): Promise<CommandUsageStat[]> {
  // SQL query to get command usage stats
  const query = `
     SELECT
       blob2 AS command_name,
       blob3 AS subcommand_group,
       blob4 AS subcommand,
       SUM(double1) as usage_count
     FROM ${env.ANALYTICS_DATASET || 'dinkdonk_bot_events'}
     WHERE 
       blob1 = 'command_used'
       AND timestamp > NOW() - INTERVAL '${days}' DAY
     GROUP BY command_name, subcommand_group, subcommand
     ORDER BY usage_count DESC, command_name ASC
   `

  // Build the API endpoint URL
  const API = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`

  const queryResponse = await fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: query,
  })

  if (queryResponse.status !== 200) {
    const errorText = await queryResponse.text()
    console.error('Analytics Engine query failed:', errorText)
    throw new Error(`Analytics query failed: ${queryResponse.status}`)
  }

  const queryJSON = await queryResponse.json() as { data: CommandUsageStat[] }
  return queryJSON.data || []
}

function formatUsageStats(stats: CommandUsageStat[], days: number): string {
  const totalUsage = stats.reduce((sum, stat) => sum + stat.usage_count, 0)

  let response = `📊 **Command Usage Stats (Last ${days} day${days === 1 ? '' : 's'})**\n`
  response += `Total commands used: **${totalUsage}**\n\n`

  // Show top 15 commands to avoid hitting Discord message limits
  const topStats = stats.slice(0, 15)

  topStats.forEach((stat, index) => {
    let commandDisplay = stat.command_name

    // Add subcommand info if present
    if (stat.subcommand_group && stat.subcommand_group.trim()) {
      commandDisplay += ` ${stat.subcommand_group}`
    }
    if (stat.subcommand && stat.subcommand.trim()) {
      commandDisplay += ` ${stat.subcommand}`
    }

    const percentage = ((stat.usage_count / totalUsage) * 100).toFixed(1)
    response += `${index + 1}. \`${commandDisplay}\` - **${stat.usage_count}** uses (${percentage}%)\n`
  })

  if (stats.length > 15) {
    response += `\n... and ${stats.length - 15} more commands`
  }

  return response
}

interface CommandUsageStat {
  command_name: string
  subcommand_group: string
  subcommand: string
  usage_count: number
}

export default {
  command: COMMANDUSAGE_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
