import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS, findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/discord/commands'

describe('kick', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'kick')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('kick')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('kick')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('kick')).toBeUndefined()
  })

  it('should have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('kick')).toBeDefined()
  })
})
