import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '../../src/discord/commands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '../../src/util/commandsHelper'

describe('twitch', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'twitch')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('twitch')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('twitch')).toBeUndefined()
  })

  it('should not have a message component handler defined', () => {
    expect(findMessageComponentHandlerByName('twitch')).toBeUndefined()
  })

  it('should not have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('twitch')).toBeUndefined()
  })
})
