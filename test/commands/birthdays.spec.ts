import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '@/discord/commands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '@/utils/commandsHelper'

describe('birthdays', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'birthdays')).toBeDefined()
  })

  it('should have all expected subcommands configured', () => {
    const birthdaysCommand = COMMAND_DEFINITIONS.find(c => c.name === 'birthdays')
    const subcommandNames = birthdaysCommand?.options?.map(option => option.name)

    expect(subcommandNames).toStrictEqual([
      'register',
      'remove',
      'upcoming',
      'list',
      'help',
      'show',
    ])
  })

  // it('should have all expected config subcommands configured', () => {
  //   const birthdaysCommand = COMMAND_DEFINITIONS.find(c => c.name === 'birthdays')
  //   const configSubcommands = birthdaysCommand?.options?.find(option => option.name === 'config')
  //   if (!configSubcommands || !('options' in configSubcommands) || !configSubcommands.options)
  //     throw new Error('Config subcommand group is missing options')
  //   const configSubcommandNames = configSubcommands.options.map(option => option.name)

  //   expect(configSubcommandNames).toStrictEqual([
  //     'details',
  //     'setup',
  //     'edit',
  //     'test',
  //   ])
  // })

  it('should have handler defined', () => {
    expect(findHandlerByName('birthdays')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('birthdays')).toBeUndefined()
  })

  it('should have message component handlers defined', () => {
    expect(findMessageComponentHandlerByName('birthday_month_select')).toBeDefined()
    expect(findMessageComponentHandlerByName('birthday_prev_page')).toBeDefined()
    expect(findMessageComponentHandlerByName('birthday_next_page')).toBeDefined()
  })

  it('should have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('birthdays')).toBeDefined()
  })
})
