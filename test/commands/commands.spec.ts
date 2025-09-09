import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '@/discord/commands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '@/utils/commandsHelper'

describe('commands', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'commands')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('commands')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('commands')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('commands')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('commands')).toBeUndefined()
  })
})
