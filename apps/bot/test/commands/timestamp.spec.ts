import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS, findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../../../src/discord/commands'

describe('timestamp', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'timestamp')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('timestamp')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('timestamp')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('timestamp')).toBeUndefined()
  })

  it('should have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('timestamp')).toBeDefined()
  })
})
