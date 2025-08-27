import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '../../src/discord/commands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/util/commandsHelper'

describe('twitchClips', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'clips')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('clips')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('clips')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('clips')).toBeUndefined()
  })

  it('should have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('clips')).toBeDefined()
  })
})
