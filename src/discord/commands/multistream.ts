import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { buildErrorEmbed, findBotCommandMarkdown, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const MULTISTREAM_COMMAND = {
  name: 'multistream',
  description: 'Multistream command has moved to /stream multistream',
  options: [
    {
      name: 'link',
      description: 'Multistream link command has moved to /stream multistream link',
      type: 1,
    },
    {
      name: 'edit',
      description: 'Multistream edit command has moved to /stream multistream edit',
      type: 1,
    },
    {
      name: 'help',
      description: 'Multistream help command has moved to /stream help',
      type: 1,
    },
    {
      name: 'unlink',
      description: 'Multistream unlink command has moved to /stream multistream unlink',
      type: 1,
    },
    {
      name: 'list',
      description: 'Multistream list command has moved to /stream multistream list',
      type: 1,
    },
  ],
}

async function handleCommand(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction)) {
    ctx.waitUntil(updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] }))
    return interactionEphemeralLoading()
  }
  const option = interaction.data.options?.[0]
  if (!option) {
    ctx.waitUntil(updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] }))
    return interactionEphemeralLoading()
  }
  if (option.type === ApplicationCommandOptionType.Subcommand) {
    switch (option.name) {
      case 'link':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'multistream', 'link')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'link')}` }))
        break
      }
      case 'unlink':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'multistream', 'unlink')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'unlink')}` }))
        break
      }
      case 'edit':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'multistream', 'edit')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'edit')}` }))
        break
      }
      case 'list':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'multistream', 'list')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'multistream', 'list')}` }))
        break
      }
      case 'help':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'multistream', 'help')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'help')}` }))
        break
      }
      default:
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'multistream')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'multistream')}` }))
        break
    }
  }
  return interactionEphemeralLoading()
}

export default {
  command: MULTISTREAM_COMMAND,
  handler: handleCommand,
} satisfies DiscordAPIApplicationCommand
