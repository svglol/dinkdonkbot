import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS, findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/discord/commands'

describe('invite', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'invite')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('invite')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('invite')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('invite')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('invite')).toBeUndefined()
  })
})
