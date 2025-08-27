import { describe, expect, it } from 'vitest'
import { ADMIN_COMMAND_DEFINITIONS } from '../../src/discord/adminCommands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/util/commandsHelper'

describe('healthcheck', () => {
  it('should have command defined', () => {
    expect(ADMIN_COMMAND_DEFINITIONS.find(c => c.name === 'healthcheck')).toBeDefined()
  })
  it('should have handler defined', () => {
    expect(findHandlerByName('healthcheck')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('healthcheck')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('healthcheck')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('healthcheck')).toBeUndefined()
  })
})
