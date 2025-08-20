import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS, findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../../src/discord/commands'

describe('rps', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'rps')).toBeDefined()
  })
  it('should have handler defined', () => {
    expect(findHandlerByName('rps')).toBeDefined()
  })
  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('rps')).toBeUndefined()
  })
  it('should have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('rps_move_select')).toBeDefined()
    expect(findMessageComponentHandlerByName('rps_rematch')).toBeDefined()
  })
  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('rps')).toBeUndefined()
  })
})
