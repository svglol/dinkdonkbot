import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { buildErrorEmbed, findBotCommandMarkdown, updateInteraction } from '@discord-api'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'

export const BIRTHDAYS_HELP_COMMAND = {
  type: 1,
  name: 'help',
  description: 'Show help for birthday commands',
}

export async function getBirthdaysHelpMessage(env: Env) {
  return `Notify everyone when it's someone's birthday.
- ${await findBotCommandMarkdown(env, 'birthdays', 'register')} - Register your birthday - <day> <month> <year> <timezone>
Year and timezone are optional - Timezone must be in IANA format or search for your location, and select from the dropdown
- ${await findBotCommandMarkdown(env, 'birthdays', 'remove')} - Remove your birthday
- ${await findBotCommandMarkdown(env, 'birthdays', 'list')} - List all birthdays registered on this server
- ${await findBotCommandMarkdown(env, 'birthdays', 'show')} - Show a specific birthday of a user
- ${await findBotCommandMarkdown(env, 'birthdays', 'upcoming')} - Show upcoming birthdays
- ${await findBotCommandMarkdown(env, 'birthdays', 'help')} - Show this help message

- ${await findBotCommandMarkdown(env, 'birthdays-config', 'setup')} - Setup birthday announcements config - <announcement-channel> <overview-channel> <role> <timezone>
- ${await findBotCommandMarkdown(env, 'birthdays-config', 'edit')} - Edit birthday announcements config - <announcement-channel> <overview-channel> <role> <timezone> <enable>
- ${await findBotCommandMarkdown(env, 'birthdays-config', 'details')} - Show the current birthday announcements configuration
- ${await findBotCommandMarkdown(env, 'birthdays-config', 'test')} - Post a test message to the announcement channel`
}

export async function handleBirthdaysHelpCommand(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type !== ApplicationCommandOptionType.Subcommand)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  const helpCard = {
    type: 17,
    accent_color: 0xFFF200,
    components: [
      {
        type: 9,
        components: [
          {
            type: 10,
            content: `# 🎂 Available Commands for Birthdays`,
          },
          {
            type: 10,
            content: await getBirthdaysHelpMessage(env),
          },
        ],
        accessory: {
          type: 11,
          media: {
            url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
          },
        },
      },
    ],
  } satisfies APIMessageTopLevelComponent
  return await updateInteraction(interaction, env, { components: [helpCard], flags: 1 << 15 })
}
