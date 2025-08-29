import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { buildErrorEmbed, findBotCommandMarkdown, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'

const TWITCH_COMMAND = {
  name: 'twitch',
  description: 'Twitch command has moved to /stream twitch',
  type: 1,
  options: [
    {
      name: 'add',
      description: 'Twitch add command has moved to /stream twitch add',
      type: 1,
    },
    {
      name: 'test',
      description: 'Twitch test command has moved to /stream twitch test',
      type: 1,
    },
    {
      name: 'remove',
      description: 'Twitch remove command has moved to /stream twitch remove',
      type: 1,
    },
    {
      name: 'edit',
      description: 'Twitch edit command has moved to /stream twitch edit',
      type: 1,
    },
    {
      name: 'list',
      description: 'Twitch list command has moved to /stream twitch list',
      type: 1,
    },
    {
      name: 'details',
      description: 'Twitch details command has moved to /stream twitch details',
      type: 1,
    },
    {
      name: 'help',
      description: 'Twitch help command has moved to /stream help',
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
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'twitch', 'add')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'add')}` }))
        break
      }
      case 'remove':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'twitch', 'remove')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'remove')}` }))
        break
      }
      case 'edit':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'twitch', 'edit')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'edit')}` }))
        break
      }
      case 'details':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'twitch', 'details')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'details')}` }))
        break
      }
      case 'test':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'twitch', 'test')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'test')}` }))
        break
      }
      case 'list':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'twitch', 'list')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'twitch', 'list')}` }))
        break
      }
      case 'help':{
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'twitch', 'help')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'help')}` }))
        break
      }
      default:
        ctx.waitUntil(updateInteraction(interaction, env, { content: `${await findBotCommandMarkdown(env, 'twitch')} command has moved to ${await findBotCommandMarkdown(env, 'stream', 'twitch')}` }))
        break
    }
  }
  return interactionEphemeralLoading()
}

export default {
  command: TWITCH_COMMAND,
  handler: handleCommand,
} satisfies DiscordAPIApplicationCommand
