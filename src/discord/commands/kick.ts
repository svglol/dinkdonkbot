import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { buildErrorEmbed, findBotCommandMarkdown, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const KICK_COMMAND = {
  name: 'kick',
  description: 'Kick command has moved to /stream kick',
  type: 1,
  options: [
    {
      name: 'add',
      description: 'Kick add command has moved to /stream kick add',
      type: 1,
    },
    {
      name: 'test',
      description: 'Kick test command has moved to /stream kick test',
      type: 1,
    },
    {
      name: 'remove',
      description: 'Kick remove command has moved to /stream kick remove',
      type: 1,
    },
    {
      name: 'edit',
      description: 'Kick edit command has moved to /stream kick edit',
      type: 1,
    },
    {
      name: 'list',
      description: 'Kick list command has moved to /stream kick list',
      type: 1,
    },
    {
      name: 'details',
      description: 'Kick details command has moved to /stream kick details',
      type: 1,
    },
    {
      name: 'help',
      description: 'Kick help command has moved to /stream help',
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
      case 'add':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'kick', 'add')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'kick', 'add')}` }))
        break
      }
      case 'remove':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'kick', 'remove')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'kick', 'remove')}` }))
        break

      }
      case 'edit':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'kick', 'edit')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'kick', 'edit')}` }))
        break
      }
      case 'details':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'kick', 'details')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'kick', 'details')}` }))
        break
      }
      case 'test':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'kick', 'test')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'kick', 'test')}` }))
        break
      }
      case 'list':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'kick', 'list')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'kick', 'list')}` }))
        break
      }
      case 'help':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'kick', 'help')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'help')}` }))
        break
      }
      default:
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'kick')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'kick')}` }))
        break
    }
  }
  return interactionEphemeralLoading()
}

export default {
  command: KICK_COMMAND,
  handler: handleCommand,
} satisfies DiscordAPIApplicationCommand
