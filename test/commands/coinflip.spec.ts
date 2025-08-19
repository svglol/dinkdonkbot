import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS, findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/discord/commands'

describe('coinflip', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'coinflip')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('coinflip')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('coinflip')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('coinflip')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('coinflip')).toBeUndefined()
  })
})
