import { DurableObject } from 'cloudflare:workers'
import { eq, tables, useDB } from '@/database/db'
import { bodyBuilder, updateMessage } from '@/discord/discord'
import { getKickChannelV2 } from '@/kick/kick'

export class KickStreamUpdater extends DurableObject {
  state: DurableObjectState
  env: Env

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.state = state
    this.env = env
  }

  async scheduleUpdate(streamMessageId: number): Promise<void> {
    await this.state.storage.put('streamMessageId', streamMessageId)
    await this.state.storage.setAlarm(Date.now() + 300000) // 5 minutes
  }

  async alarm(): Promise<void> {
    const streamMessageId = await this.state.storage.get<number>('streamMessageId')
    if (!streamMessageId)
      return

    try {
      const streamMessage = await useDB(this.env).query.streamMessages.findFirst({
        where: eq(tables.streamMessages.id, streamMessageId),
        with: {
          stream: { with: { multiStream: true } },
          kickStream: { with: { multiStream: true } },
        },
      })

      if (!streamMessage?.discordMessageId)
        return

      if (!streamMessage.kickStreamerData) {
        streamMessage.kickStreamerData = await getKickChannelV2(streamMessage.kickStream?.broadcasterId || '', this.env) || null
        await useDB(this.env).update(tables.streamMessages).set({
          kickStreamerData: streamMessage.kickStreamerData,
        }).where(eq(tables.streamMessages.id, streamMessageId)).execute()
      }

      const discordMessage = await bodyBuilder(streamMessage, this.env)
      await updateMessage(streamMessage.discordChannelId, streamMessage.discordMessageId, this.env, discordMessage)
    }
    catch (error) {
      console.error('Failed to perform kick message update:', error)
    }
    finally {
      await this.state.storage.deleteAll()
    }
  }
}
