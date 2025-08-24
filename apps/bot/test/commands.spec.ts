import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/v10'
import { describe, expect, it } from 'vitest'
import { COMMAND_DEFINITIONS } from '../src/discord/commands'

describe('all commands', () => {
  it('should satisfy Discord API command structure', () => {
    COMMAND_DEFINITIONS.forEach((command) => {
      // Type assertion to ensure compile-time checking
      const _: RESTPostAPIApplicationCommandsJSONBody = command

      // Runtime checks
      expect(command).toHaveProperty('name')
      expect(command.name).toBeTypeOf('string')
      expect(command.name.length).toBeGreaterThan(0)
      expect(command.name.length).toBeLessThanOrEqual(32)

      if (command.type !== undefined) {
        expect(command.type).toBeTypeOf('number')
      }
    })
  })
})
