import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '@/discord/commands'
import { findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName, findModalSubmitHandlerByName } from '@/utils/commandsHelper'

describe('streams', () => {
  it('should have command defined', () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'streams')).toBeDefined()
  })

  it('should have handler defined', () => {
    expect(findHandlerByName('streams')).toBeDefined()
  })

  it('should not have a modal submit handler defined', () => {
    expect(findModalSubmitHandlerByName('streams')).toBeUndefined()
  })

  it('should have message component handlers defined', () => {
    expect(findMessageComponentHandlerByName('stream_help_page_select')).toBeDefined()
    expect(findMessageComponentHandlerByName('stream_type_select')).toBeDefined()
    expect(findMessageComponentHandlerByName('stream_prev_page')).toBeDefined()
    expect(findMessageComponentHandlerByName('stream_next_page')).toBeDefined()
  })

  it('should have a autocomplete handler defined', () => {
    expect(findAutoCompleteHandlerByName('streams')).toBeDefined()
  })
})
