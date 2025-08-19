import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS, findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/discord/commands'

describe('weather', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'weather')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('weather')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('weather')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('weather')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('weather')).toBeUndefined()
  })
})
