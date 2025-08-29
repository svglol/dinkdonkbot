import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '../../src/discord/commands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/util/commandsHelper'

describe('streams', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'streams')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('streams')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('streams')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('streams')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('streams')).toBeDefined()
  })
})
