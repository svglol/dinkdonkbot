import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS, findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../../src/discord/commands'

describe('hangman', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'hangman')).toBeDefined()
  })
  it('should have handler defined', () => {
    expect(findHandlerByName('hangman')).toBeDefined()
  })
  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('hangman_guess_modal')).toBeDefined()
  })
  it('should have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('hangman_make_guess')).toBeDefined()
  })
  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('rps')).toBeUndefined()
  })
})
