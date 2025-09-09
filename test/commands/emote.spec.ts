import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '@/discord/commands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '@/utils/commandsHelper'

describe('emote', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'emote')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('emote')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('emote')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('emote')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('emote')).toBeUndefined()
  })
})
