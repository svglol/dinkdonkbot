import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS, findAutoCompleteHandlerByName, findHandlerByName, findMessageComponentHandlerByName } from '../src/discord/commands'

describe('commands all have handlers defined', () => {
  it('dinkdonk', async () => {
    expect(findHandlerByName('dinkdonk')).toBeDefined()
  })

  it('invite', async () => {
    expect(findHandlerByName('invite')).toBeDefined()
  })

  it('help', async () => {
    expect(findHandlerByName('help')).toBeDefined()
  })

  it('twitch', async () => {
    expect(findHandlerByName('twitch')).toBeDefined()
  })

  it('emote', async () => {
    expect(findHandlerByName('emote')).toBeDefined()
  })

  it('kick', async () => {
    expect(findHandlerByName('kick')).toBeDefined()
  })

  it('twitchClips', async () => {
    expect(findHandlerByName('clips')).toBeDefined()
  })

  it('stealEmote', async () => {
    expect(findHandlerByName('steal emote/sticker')).toBeDefined()
  })

  it('time', async () => {
    expect(findHandlerByName('time')).toBeDefined()
  })

  it('weather', async () => {
    expect(findHandlerByName('weather')).toBeDefined()
  })

  it('timestamp', async () => {
    expect(findHandlerByName('timestamp')).toBeDefined()
  })

  it('randomemote', async () => {
    expect(findHandlerByName('randomemote')).toBeDefined()
  })
})

describe('commands all have definitions', () => {
  it('dinkdonk', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'dinkdonk')).toBeDefined()
  })

  it('invite', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'invite')).toBeDefined()
  })

  it('help', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'help')).toBeDefined()
  })

  it('twitch', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'twitch')).toBeDefined()
  })

  it('emote', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'emote')).toBeDefined()
  })

  it('kick', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'kick')).toBeDefined()
  })

  it('twitchClips', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'clips')).toBeDefined()
  })

  it('stealEmote', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'Steal Emote/Sticker')).toBeDefined()
  })

  it('time', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'time')).toBeDefined()
  })

  it('weather', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'weather')).toBeDefined()
  })

  it('timestamp', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'timestamp')).toBeDefined()
  })

  it('randomemote', async () => {
    expect(COMMAND_DEFINITIONS.find(c => c.name === 'randomemote')).toBeDefined()
  })
})

describe('commands have autocomplete handlers', () => {
  it('twitch', async () => {
    expect(findAutoCompleteHandlerByName('twitch')).toBeDefined()
  })

  it('kick', async () => {
    expect(findAutoCompleteHandlerByName('kick')).toBeDefined()
  })

  it('clips', async () => {
    expect(findAutoCompleteHandlerByName('clips')).toBeDefined()
  })

  it('timestamp', async () => {
    expect(findAutoCompleteHandlerByName('timestamp')).toBeDefined()
  })
})

describe('commands have message component handlers', () => {
  it('help', async () => {
    expect(findMessageComponentHandlerByName('help_page_select')).toBeDefined()
  })
})

describe('commands have modal submit handlers', () => {
  it('should have no tests defined', () => {
    expect(true).toBe(true)
  })
})
