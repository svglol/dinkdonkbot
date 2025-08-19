import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS, findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/discord/commands'

describe('dinkdonk', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'dinkdonk')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('dinkdonk')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('dinkdonk')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('dinkdonk')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('dinkdonk')).toBeUndefined()
  })
})
