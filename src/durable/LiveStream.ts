import type { MultiStream, Stream, StreamKick, StreamMessage } from '@/database/db'
import { bodyBuilder, sendMessage, updateMessage } from '@discord-api'
import { DurableObject } from 'cloudflare:workers'
import { and, eq, tables, useDB } from '@/database/db'

interface PersistedState {
  twitchLive: boolean
  kickLive: boolean
  streamId?: number
  kickStreamId?: number
  multiStreamId?: number
  streamMessageId?: number
  alarmScheduled: boolean
}

const ALARM_TIME = 15000 // 15 seconds

export class LiveStream extends DurableObject {
  state: DurableObjectState
  env: Env

  // In-memory state (will be synced with persistent state)
  private twitchLive: boolean = false
  private kickLive: boolean = false
  private stream?: Stream | null
  private kickStream?: StreamKick | null
  private multiStream?: MultiStream | null
  private streamMessage?: StreamMessage
  private alarmScheduled: boolean = false

  /**
   * Initializes a new LiveStream durable object.
   * @param state The underlying durable object state
   * @param env The environment variables for accessing configuration and services
   *
   * When constructed, the state is loaded from storage using {@link loadState}, and
   * any existing stream messages are loaded from the database.
   */
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.state = state
    this.env = env
    // Load state on construction
    this.state.blockConcurrencyWhile(async () => {
      await this.loadState()
    })
  }

  private async loadState(): Promise<void> {
    try {
      const persistedState = await this.state.storage.get<PersistedState>('channelState')
      if (persistedState) {
        this.twitchLive = persistedState.twitchLive
        this.kickLive = persistedState.kickLive
        this.alarmScheduled = persistedState.alarmScheduled

        // Reload data from database if we have IDs
        if (persistedState.streamId) {
          this.stream = await useDB(this.env).query.streams.findFirst({
            where: eq(tables.streams.id, persistedState.streamId),
          })
        }
        if (persistedState.kickStreamId) {
          this.kickStream = await useDB(this.env).query.kickStreams.findFirst({
            where: eq(tables.kickStreams.id, persistedState.kickStreamId),
          })
        }
        if (persistedState.multiStreamId) {
          this.multiStream = await useDB(this.env).query.multiStream.findFirst({
            where: eq(tables.multiStream.id, persistedState.multiStreamId),
          })
        }
        if (persistedState.streamMessageId) {
          this.streamMessage = await useDB(this.env).query.streamMessages.findFirst({
            where: eq(tables.streamMessages.id, persistedState.streamMessageId),
            with: {
              stream: { with: { multiStream: true } },
              kickStream: { with: { multiStream: true } },
            },
          })
        }
      }
    }
    catch (error) {
      console.error('Failed to load persisted state:', error)
      // Continue with default state if loading fails
    }
  }

  private async saveState(): Promise<void> {
    try {
      const stateToSave: PersistedState = {
        twitchLive: this.twitchLive,
        kickLive: this.kickLive,
        streamId: this.stream?.id,
        kickStreamId: this.kickStream?.id,
        multiStreamId: this.multiStream?.id,
        streamMessageId: this.streamMessage?.id,
        alarmScheduled: this.alarmScheduled,
      }

      await this.state.storage.put('channelState', stateToSave)
    }
    catch (error) {
      console.error('Failed to save state:', error)
      // Don't throw - continue execution even if state save fails
    }
  }

  /**
   * Handles incoming stream events by processing the request based on the platform.
   *
   * This function is responsible for coordinating the handling of stream events
   * from different platforms, such as Twitch and Kick, by delegating the request
   * to a blocking handler to ensure atomic operations. It ensures that the state
   * is updated correctly and any necessary actions are performed based on the
   * event data.
   *
   * @param params - The parameters that include the platform and the payload
   *                 associated with the stream event.
   * @returns A promise resolving to a Response indicating the outcome of the
   *          request handling.
   */

  async handleStream(params: StreamHandlerParams): Promise<Response> {
    return await this.state.blockConcurrencyWhile(async () => {
      return await this.handleRequestBlocking(params)
    })
  }

  /**
   * Handles an incoming stream event by processing the request based on the platform.
   *
   * This function is responsible for updating the durable object state based on the
   * stream event, and for scheduling an alarm if necessary. It also handles notification
   * processing and resets the state when both the Twitch and Kick streams are live.
   *
   * @param params - The parameters that include the platform and the payload
   *                 associated with the stream event.
   * @param params.stream - The stream/kick stream database object associated with the stream event.
   * @param params.streamerData - The streamer data associated with the stream event.
   * @param params.streamData - The stream data associated with the stream event.
   * @param params.platform - The platform of the stream event. Can be 'twitch' or 'kick'.
   * @param params.payload - The payload associated with the stream event.
   * @returns A promise resolving to a Response indicating the outcome of the
   *          request handling.
   */
  async handleRequestBlocking({ platform, payload, stream, streamerData, streamData }: StreamHandlerParams): Promise<Response> {
    try {
      if (platform === 'twitch') {
        this.twitchLive = true
        this.stream = stream
        this.multiStream = this.stream?.multiStream
        await this.updateTwitchStreamMessages(payload, streamerData, streamData)
      }
      if (platform === 'kick') {
        this.kickLive = true
        this.kickStream = stream
        this.multiStream = this.kickStream?.multiStream
        await this.updateKickStreamMessages(payload, streamerData, streamData)
      }

      if (this.twitchLive && this.kickLive) {
        await this.clearAlarm()
        await this.processNotifications()
        await this.reset()
      }
      else if (this.multiStream) {
        await this.scheduleAlarm()
      }
      else {
        await this.processNotifications()
        await this.clearAlarm()
        await this.reset()
      }

      // Save state after processing
      await this.saveState()

      return new Response('OK')
    }
    catch (error) {
      console.error('Error in fetch:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }

  /**
   * Handles the alarm event by processing notifications and resetting the state.
   *
   * This function is triggered when an alarm event occurs. It sets the `alarmScheduled`
   * flag to false, processes any pending notifications if the Twitch or Kick streams
   * are live, and then resets the state. If an error occurs during the process,
   * it logs the error to the console.
   */
  async alarm(): Promise<void> {
    try {
      this.alarmScheduled = false

      // Process notifications based on current state
      if (this.twitchLive || this.kickLive) {
        await this.processNotifications()
      }

      // Clean up after processing
      await this.reset()
    }
    catch (error) {
      console.error('Error in alarm:', error)
    }
  }

  /**
   * Schedules an alarm for 15 seconds from now to trigger the alarm handler.
   *
   * This function is called when a new stream message is received and the state
   * should be updated. It checks if an alarm is already scheduled and if there
   * are any stream messages to process. If an alarm is not already scheduled and
   * there are stream messages to process, it sets an alarm for 15 seconds from
   * now and marks the `alarmScheduled` flag as true. If an error occurs while
   * setting the alarm, it logs the error to the console.
   */
  private async scheduleAlarm(): Promise<void> {
    if (this.alarmScheduled) {
      return // Alarm already scheduled or no reason to schedule
    }

    try {
      const alarmTime = Date.now() + ALARM_TIME
      await this.state.storage.setAlarm(alarmTime)
      this.alarmScheduled = true
      await this.saveState()
    }
    catch (error) {
      console.error('Failed to schedule alarm:', error)
    }
  }

  /**
   * Clears the scheduled alarm and marks the `alarmScheduled` flag as false.
   *
   * This function is called when the bot is done processing notifications and
   * should reset its state. If the alarm is not scheduled, it returns without
   * doing anything. If an error occurs while clearing the alarm, it logs the
   * error to the console.
   */
  private async clearAlarm(): Promise<void> {
    if (!this.alarmScheduled) {
      return
    }

    try {
      await this.state.storage.deleteAlarm()
      this.alarmScheduled = false
    }
    catch (error) {
      console.error('Failed to clear alarm:', error)
    }
  }

  private async processNotifications(): Promise<void> {
    if (!this.streamMessage) {
      return
    }
    await this.sendNotification(this.streamMessage)
  }

  /**
   * Sends a notification to Discord for a stream message. If the notification
   * is sent successfully, it updates the database to associate the message
   * ID with the stream message and removes the stream message from the array
   * of messages to process. If there is an error sending the notification,
   * it logs the error to the console but continues processing the remaining
   * notifications.
   *
   * @param streamMessage - The stream message to send a notification for.
   */
  private async sendNotification(streamMessage: StreamMessage): Promise<void> {
    try {
      const discordMessage = bodyBuilder(streamMessage, this.env)
      const messageId = await sendMessage(streamMessage.discordChannelId, discordMessage, this.env)
      await useDB(this.env).update(tables.streamMessages).set({ discordMessageId: messageId }).where(eq(tables.streamMessages.id, streamMessage.id))
    }
    catch (error) {
      console.error(`Failed to send notification for stream message ${streamMessage.id}:`, error)
    }
  }

  async updateTwitchStreamMessages(payload: SubscriptionEventResponseData<SubscriptionType>, streamerData?: TwitchUser | null, streamData?: TwitchStream | null) {
    try {
      const event = payload.event as OnlineEventData
      if (!this.streamMessage) {
        // multistream late merging
        const multiStream = this.stream?.multiStream || this.kickStream?.multiStream
        if (multiStream && multiStream?.lateMerge) {
          // check if there is an applicable streamMessage we can merge with (kick stream from multistream)
          const streamMessage = await useDB(this.env).query.streamMessages.findFirst({
            where: and(eq(tables.streamMessages.kickStreamId, multiStream.kickStreamId), eq(tables.streamMessages.kickOnline, true)),
            with: {
              stream: { with: { multiStream: true } },
              kickStream: { with: { multiStream: true } },
            },
          })

          if (streamMessage) {
            // update existing stream message with new data
            await useDB(this.env).update(tables.streamMessages).set({
              streamId: this.stream?.id ?? null,
              twitchStreamId: event.id,
              twitchOnline: true,
              twitchStreamStartedAt: new Date(event.started_at),
              twitchStreamerData: streamerData,
              twitchStreamData: streamData,
            }).where(eq(tables.streamMessages.id, streamMessage.id))

            const updatedMessageWithStreams = await useDB(this.env).query.streamMessages.findFirst({
              where: eq(tables.streamMessages.id, streamMessage.id),
              with: {
                stream: true,
                kickStream: true,
              },
            })
            if (updatedMessageWithStreams) {
            // then we can update the existing discord message instead of sending a new one and close the durable object
              const discordMessage = bodyBuilder(updatedMessageWithStreams, this.env)
              await updateMessage(updatedMessageWithStreams.discordChannelId, updatedMessageWithStreams?.discordMessageId ?? '', this.env, discordMessage)

              this.reset()
              return
            }
          }
        }

        // No stream message (we need to create a new one)
        const inserted = await useDB(this.env).insert(tables.streamMessages).values({
          discordChannelId: this.stream?.channelId ?? '',
          streamId: this.stream?.id ?? null,
          twitchOnline: true,
          twitchStreamId: event.id,
          twitchStreamStartedAt: new Date(event.started_at),
          twitchStreamerData: streamerData,
          twitchStreamData: streamData,
        }).returning({ id: tables.streamMessages.id }).get()

        this.streamMessage = await useDB(this.env).query.streamMessages.findFirst({
          where: eq(tables.streamMessages.id, inserted.id),
          with: {
            stream: { with: { multiStream: true } },
            kickStream: { with: { multiStream: true } },
          },
        })
        this.stream = this.streamMessage?.stream
      }
      else {
        // Update existing stream message with new data
        await useDB(this.env).update(tables.streamMessages).set({
          streamId: this.stream?.id ?? null,
          twitchStreamId: event.id,
          twitchOnline: true,
          twitchStreamStartedAt: new Date(event.started_at),
          twitchStreamerData: streamerData,
          twitchStreamData: streamData,
        }).where(eq(tables.streamMessages.id, this.streamMessage.id))

        this.streamMessage = await useDB(this.env).query.streamMessages.findFirst({
          where: eq(tables.streamMessages.id, this.streamMessage.id),
          with: {
            stream: { with: { multiStream: true } },
            kickStream: { with: { multiStream: true } },
          },
        })
        this.stream = this.streamMessage?.stream
      }
    }
    catch (error) {
      console.error('Error updating Twitch stream messages:', error)
    }
  }

  async updateKickStreamMessages(payload: KickLivestreamStatusUpdatedEvent, streamerData?: KickChannelV2 | null, streamData?: KickLiveStream | null) {
    try {
      if (!this.streamMessage) {
        // multistream late merging
        const multiStream = this.stream?.multiStream || this.kickStream?.multiStream
        if (multiStream && multiStream?.lateMerge) {
          // check if there is an applicable streamMessage we can merge with (twitch stream from multistream)
          const streamMessage = await useDB(this.env).query.streamMessages.findFirst({
            where: and(eq(tables.streamMessages.streamId, multiStream.streamId), eq(tables.streamMessages.twitchOnline, true)),
            with: {
              stream: { with: { multiStream: true } },
              kickStream: { with: { multiStream: true } },
            },
          })

          if (streamMessage) {
            // update existing stream message with new data
            await useDB(this.env).update(tables.streamMessages).set({
              kickStreamId: this.kickStream?.id ?? null,
              kickOnline: true,
              kickStreamStartedAt: new Date(payload.started_at),
              kickStreamData: streamData,
              kickStreamerData: streamerData,
            }).where(eq(tables.streamMessages.id, streamMessage.id))

            const updatedMessageWithStreams = await useDB(this.env).query.streamMessages.findFirst({
              where: eq(tables.streamMessages.id, streamMessage.id),
              with: {
                stream: true,
                kickStream: true,
              },
            })
            if (updatedMessageWithStreams) {
            // then we can update the existing discord message instead of sending a new one and close the durable object
              const discordMessage = bodyBuilder(updatedMessageWithStreams, this.env)
              await updateMessage(updatedMessageWithStreams.discordChannelId, updatedMessageWithStreams?.discordMessageId ?? '', this.env, discordMessage)

              this.reset()
              return
            }
          }
        }

        const inserted = await useDB(this.env).insert(tables.streamMessages).values({
          discordChannelId: this.kickStream?.channelId ?? '',
          kickStreamId: this.kickStream?.id ?? null,
          kickOnline: true,
          kickStreamStartedAt: new Date(payload.started_at),
          kickStreamData: streamData,
          kickStreamerData: streamerData,
        }).returning({ id: tables.streamMessages.id }).get()

        this.streamMessage = await useDB(this.env).query.streamMessages.findFirst({
          where: eq(tables.streamMessages.id, inserted.id),
          with: {
            stream: { with: { multiStream: true } },
            kickStream: { with: { multiStream: true } },
          },
        })
        this.kickStream = this.streamMessage?.kickStream
      }
      else {
        await useDB(this.env).update(tables.streamMessages).set({
          kickStreamId: this.kickStream?.id ?? null,
          kickOnline: true,
          kickStreamStartedAt: new Date(payload.started_at),
          kickStreamData: streamData,
          kickStreamerData: streamerData,
        }).where(eq(tables.streamMessages.id, this.streamMessage.id))

        this.streamMessage = await useDB(this.env).query.streamMessages.findFirst({
          where: eq(tables.streamMessages.id, this.streamMessage.id),
          with: {
            stream: { with: { multiStream: true } },
            kickStream: { with: { multiStream: true } },
          },
        })

        this.kickStream = this.streamMessage?.kickStream
      }
    }
    catch (error) {
      console.error('Error updating Kick stream messages:', error)
    }
  }

  /**
   * Resets the state of the durable object, clearing all messages and turning off notifications.
   * This function is called when the durable object is first created.
   */
  async reset(): Promise<void> {
    this.twitchLive = false
    this.kickLive = false
    this.streamMessage = undefined
    this.kickStream = undefined
    this.stream = undefined
    this.multiStream = undefined

    await this.clearAlarm()
    await this.saveState()
  }
}

type StreamHandlerParams
  = | { platform: 'twitch', payload: SubscriptionEventResponseData<SubscriptionType>, stream?: Stream | null, streamerData?: TwitchUser | null, streamData?: TwitchStream | null }
    | { platform: 'kick', payload: KickLivestreamStatusUpdatedEvent, stream?: StreamKick | null, streamerData?: KickChannelV2 | null, streamData?: KickLiveStream | null }
