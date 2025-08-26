import type { APIApplicationCommand, APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils'
import { DINKDONK_EMOTE } from '../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, fetchBotCommands, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const COMMANDS_COMMAND = {
  name: 'commands',
  description: 'List all commands for DinkDonk Bot',
}

/**
 * Handles the /commands command.
 */
async function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(listCommands(interaction, env))
  return interactionEphemeralLoading()
}

function formatSlashCommand(command: APIApplicationCommand): string {
  const lines: string[] = []

  // Top-level command
  lines.push(`- </${command.name}:${command.id}> - ${command.description}`)

  if (command.options && command.options.length > 0) {
    command.options.forEach((option) => {
      if (option.type === 1) {
        // Subcommand
        lines.push(`  • </${command.name} ${option.name}:${command.id}> - ${option.description}`)
      }
      else if (option.type === 2 && option.options) {
        // Subcommand group
        option.options.forEach((sub) => {
          if (sub.type === 1) {
            lines.push(
              `  • </${command.name} ${option.name} ${sub.name}:${command.id}> - ${sub.description}`,
            )
          }
        })
      }
    })
  }

  return lines.join('\n')
}

async function listCommands(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction)) {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [buildErrorEmbed('Invalid interaction', env)],
    })
  }

  const commands = await fetchBotCommands(env.DISCORD_TOKEN, env)
  const slashCommands = commands.filter(c => c.type === 1).sort((a, b) => a.name.localeCompare(b.name))
  const userCommands = commands.filter(c => c.type === 2).sort((a, b) => a.name.localeCompare(b.name))
  const messageCommands = commands.filter(c => c.type === 3).sort((a, b) => a.name.localeCompare(b.name))

  const content = [
    slashCommands.length > 0
      ? `**Slash Commands:**\n${slashCommands.map(formatSlashCommand).join('\n')}`
      : null,
    userCommands.length > 0
      ? `**User Commands:**\n${userCommands.map(c => `- ${c.name}`).join('\n')}`
      : null,
    messageCommands.length > 0
      ? `**Message Commands:**\n${messageCommands.map(c => `- ${c.name}`).join('\n')}`
      : null,
  ].filter(Boolean).join('\n\n')

  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
    embeds: [
      buildSuccessEmbed(content, env, {
        title: `${DINKDONK_EMOTE.formatted} DinkDonk Bot Commands`,
        color: 0xFFF200,
      }),
    ],
  })
}
/**
 * Fetches and lists all bot commands.
 */
export async function listAllBotCommands(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction)) {
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [buildErrorEmbed('Invalid interaction', env)],
    })
  }
  const commands = (await fetchBotCommands(env.DISCORD_TOKEN, env)).filter(c => c.type === 1).sort((a, b) => a.name.localeCompare(b.name))
  const content = commands.length > 0 ? `${commands.map(c => `- </${c.name}:${c.id}> - ${c.description}`).join('\n')}` : '⚠️ No commands found.'
  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(content, env, { title: `${DINKDONK_EMOTE.formatted} DinkDonk Bot Commands`, color: 0xFFF200 })] })
}

export default {
  command: COMMANDS_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
