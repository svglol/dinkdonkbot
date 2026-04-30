import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '@/discord/commands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '@/utils/commandsHelper'

describe('birthdays-config', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'birthdays-config')).toBeDefined()
  })

  it('should have all expected subcommands configured', () => {
    const command = COMMAND_DEFINITIONS.find(c => c.name === 'birthdays-config')
    const subcommandNames = command?.options?.map(option => option.name)
    expect(subcommandNames).toStrictEqual([
      'details',
      'setup',
      'edit',
      'test',
    ])
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('birthdays-config')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('birthdays-config')).toBeUndefined()
  })

  it('should not have message component handlers defined', () => {
    expect(findMessageComponentHandlerByName('birthdays-config')).toBeUndefined()
  })

  it('should have an autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('birthdays-config')).toBeDefined()
  })
})
