import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '../../src/discord/commands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/util/commandsHelper'

describe('help', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'help')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('help')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('help')).toBeUndefined()
  })

  it('should have message component handlers defined', () => {
    expect(findMessageComponentHandlerByName('help_page_select')).toBeDefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('help')).toBeUndefined()
  })
})
