import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '../../src/discord/commands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/util/commandsHelper'

describe('quickstart', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'quickstart')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('quickstart')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('quickstart')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('quickstart')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('quickstart')).toBeUndefined()
  })
})
