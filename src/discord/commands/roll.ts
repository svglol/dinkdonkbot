import type { APIApplicationCommandInteraction } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction } from 'discord-api-types/utils'
import { buildErrorEmbed, updateInteraction } from '../discord'
import { interactionLoading } from '../interactionHandler'

const ROLL_COMMAND = {
  name: 'roll',
  description: 'Roll some dice',
  options: [
    {
      name: 'dice',
      description: 'Number of dice to roll',
      type: 4,
      min_value: 1,
      max_value: 10,
    },
    {
      name: 'sides',
      description: 'Number of sides per die',
      type: 4,
      min_value: 2,
      max_value: 1000,
    },
  ],
}

/**
 * Handles the /roll command.
 * @param interaction The interaction object from Discord
 * @param env The environment object containing configuration and authentication details.
 * @param ctx The context object from Cloudflare
 * @returns A promise that resolves to nothing. Updates the interaction with a message containing the result of the dice roll.
 */
async function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(roll(interaction, env))
  return interactionLoading()
}

async function roll(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  let diceCount = 1
  let sides = 6
  if (interaction.data.options) {
    const diceCountOption = interaction.data.options.find(option => option.name === 'dice')
    diceCount = diceCountOption && 'value' in diceCountOption ? diceCountOption.value as number : 1

    const sidesOption = interaction.data.options.find(option => option.name === 'sides')
    sides = sidesOption && 'value' in sidesOption ? sidesOption.value as number : 6
  }

  const rolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * sides) + 1)

  const content = `🎲 You rolled ${diceCount}d${sides}: **${rolls.map(r => `${r}/${sides}`).join(' ')}** (total: ${rolls.reduce((a, b) => a + b, 0)})`

  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { content })
}

export default {
  command: ROLL_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
