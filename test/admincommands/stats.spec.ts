import { describe, expect, it } from 'vitest'
import { ADMIN_COMMAND_DEFINITIONS } from '../../src/discord/adminCommands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/util/commandsHelper'

describe('stats', () => {
  it('should have command defined', () => {
    expect(ADMIN_COMMAND_DEFINITIONS.find(c => c.name === 'stats')).toBeDefined()
  })
  it('should have handler defined', () => {
    expect(findHandlerByName('stats')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('stats')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('stats')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('stats')).toBeUndefined()
  })
})
