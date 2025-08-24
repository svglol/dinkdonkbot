import type { StreamMessage } from '../database/db'
import { DurableObject } from 'cloudflare:workers'
import { eq, tables, useDB } from '../database/db'
import { bodyBuilder, sendMessage } from '../discord/discord'
import { getKickChannelV2, getKickLivestream } from '../kick/kick'
import { getStreamDetails, getStreamerDetails } from '../twitch/twitch'

interface PersistedState {
  twitchLive: boolean
  kickLive: boolean
  streamMessageIds: number[]
  alarmScheduled: boolean
  lastUpdated: number
}

const ALARM_TIME = 10000 // 10 seconds

// ! Current limitations: channel names must match exactly between kick/twitch so they share the same durable object. Maybe we need to make this a durable object per discord channel or per stream message?
export class ChannelState extends DurableObject {
  state: DurableObjectState
  env: Env

  // In-memory state (will be synced with persistent state)
  private twitchLive: boolean = false
  private kickLive: boolean = false
  private streamMessages: StreamMessage[] | null = null
  private alarmScheduled: boolean = false

  /**
   * Initializes a new ChannelState durable object.
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

  /**
   * Loads the persisted state for this durable object from storage.
   *
   * On load, the state is retrieved from storage and the following values are loaded:
   *   - `twitchLive` and `kickLive` from persisted state
   *   - `alarmScheduled` from persisted state
   *   - `streamMessages` from database if persisted state contains IDs
   *
   * If the load fails, the durable object will continue with default state.
   */
  private async loadState(): Promise<void> {
    try {
      const persistedState = await this.state.storage.get<PersistedState>('channelState')

      if (persistedState) {
        this.twitchLive = persistedState.twitchLive
        this.kickLive = persistedState.kickLive
        this.alarmScheduled = persistedState.alarmScheduled

        // Reload stream messages from database if we have IDs
        if (persistedState.streamMessageIds.length > 0) {
          this.streamMessages = await useDB(this.env).query.streamMessages.findMany({
            with: {
              stream: true,
              kickStream: true,
            },
            where: (messages, { inArray }) => inArray(messages.id, persistedState.streamMessageIds),
          })
        }
      }
    }
    catch (error) {
      console.error('Failed to load persisted state:', error)
      // Continue with default state if loading fails
    }
  }

  /**
   * Saves the current state of the durable object to storage.
   *
   * Saves the following values to storage:
   *   - `twitchLive` and `kickLive` booleans
   *   - `alarmScheduled` boolean
   *   - `streamMessageIds` array of IDs of stream messages in database
   *   - `lastUpdated` timestamp of when the state was last updated
   *
   * If the save fails, the durable object will continue execution without throwing an error.
   */
  private async saveState(): Promise<void> {
    try {
      const stateToSave: PersistedState = {
        twitchLive: this.twitchLive,
        kickLive: this.kickLive,
        streamMessageIds: this.streamMessages?.map(msg => msg.id) ?? [],
        alarmScheduled: this.alarmScheduled,
        lastUpdated: Date.now(),
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
   * @param params.platform - The platform of the stream event. Can be 'twitch' or 'kick'.
   * @param params.payload - The payload associated with the stream event.
   * @returns A promise resolving to a Response indicating the outcome of the
   *          request handling.
   */
  async handleRequestBlocking({ platform, payload }: StreamHandlerParams): Promise<Response> {
    try {
      if (platform === 'twitch') {
        this.twitchLive = true
        await this.updateTwitchStreamMessages(payload)
      }
      if (platform === 'kick') {
        this.kickLive = true
        await this.updateKickStreamMessages(payload)
      }

      if (this.twitchLive && this.kickLive) {
        await this.clearAlarm()
        await this.processNotifications()
        await this.reset()
      }
      else if (this.streamMessages !== null && this.streamMessages.length > 0) {
        await this.scheduleAlarm()
      }
      else {
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
   * Schedules an alarm for 10 seconds from now to trigger the alarm handler.
   *
   * This function is called when a new stream message is received and the state
   * should be updated. It checks if an alarm is already scheduled and if there
   * are any stream messages to process. If an alarm is not already scheduled and
   * there are stream messages to process, it sets an alarm for 10 seconds from
   * now and marks the `alarmScheduled` flag as true. If an error occurs while
   * setting the alarm, it logs the error to the console.
   */
  private async scheduleAlarm(): Promise<void> {
    if (this.alarmScheduled || this.streamMessages?.length === 0) {
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

  /**
   * Process any pending stream messages by sending notifications to the
   * associated Discord channels. If there are no stream messages to process,
   * it returns without doing anything.
   *
   * It maps over the stream messages to create an array of promises that
   * send the notifications to Discord and then waits for all of those
   * promises to settle. If a notification fails to send, it logs the
   * error to the console but continues processing the remaining
   * notifications.
   */
  private async processNotifications(): Promise<void> {
    if (!this.streamMessages || this.streamMessages.length === 0) {
      return
    }

    const notificationPromises = this.streamMessages.map(streamMessage =>
      this.sendNotification(streamMessage),
    )

    await Promise.allSettled(notificationPromises)
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
      const messageId = await sendMessage(
        streamMessage.discordChannelId,
        this.env.DISCORD_TOKEN,
        discordMessage,
        this.env,
      )
      await useDB(this.env).update(tables.streamMessages).set({ discordMessageId: messageId }).where(eq(tables.streamMessages.id, streamMessage.id))

      // Remove the sent message from our array
      this.streamMessages = this.streamMessages?.filter(message => message.id !== streamMessage.id) ?? null
    }
    catch (error) {
      console.error(`Failed to send notification for stream message ${streamMessage.id}:`, error)
    }
  }

  /**
   * Updates the stream messages for a Twitch stream based on a 'stream.online'
   * event. If the stream messages array is empty, it creates new messages in the
   * database for the channel. If the array is not empty, it updates the existing
   * messages. It also checks if any messages can be sent immediately and sends
   * them if possible.
   *
   * @param payload - The payload containing the event data and subscription details.
   */
  async updateTwitchStreamMessages(payload: SubscriptionEventResponseData<SubscriptionType>) {
    try {
      const event = payload.event as OnlineEventData

      if (!this.streamMessages) {
      // Create new messages in the database for this channel
        const subscriptions = await useDB(this.env).query.streams.findMany({
          where: (streams, { eq }) => eq(streams.broadcasterId, event.broadcaster_user_id),
        })

        const [streamerData, streamData] = await Promise.all([
          getStreamerDetails(event.broadcaster_user_name, this.env),
          getStreamDetails(event.broadcaster_user_name, this.env),
        ])

        const insertedIds: number[] = []

        for (const subscription of subscriptions) {
          const inserted = await useDB(this.env).insert(tables.streamMessages).values({
            discordChannelId: subscription.channelId,
            streamId: subscription.id,
            twitchOnline: true,
            twitchStreamStartedAt: new Date(event.started_at),
            twitchStreamerData: streamerData,
            twitchStreamData: streamData,
            twitchStreamId: event.id,
          }).returning({ id: tables.streamMessages.id }).get()

          insertedIds.push(inserted.id)
        }

        this.streamMessages = await useDB(this.env).query.streamMessages.findMany({
          with: {
            stream: true,
            kickStream: true,
          },
          where: (messages, { inArray }) => inArray(messages.id, insertedIds),
        })
      }
      else {
      // Update existing messages
        const [streamerData, streamData] = await Promise.all([
          getStreamerDetails(payload.event?.broadcaster_user_name ?? '', this.env),
          getStreamDetails(payload.event?.broadcaster_user_name ?? '', this.env),
        ])
        const subscriptions = await useDB(this.env).query.streams.findMany({
          where: (streams, { eq }) => eq(streams.broadcasterId, event.broadcaster_user_id),
        })
        const updatedIds: number[] = []
        for (const message of this.streamMessages ?? []) {
          const stream = subscriptions.find(sub => sub.channelId === message.discordChannelId)
          const updated = await useDB(this.env).update(tables.streamMessages).set({
            streamId: stream?.id ?? 0,
            twitchOnline: true,
            twitchStreamStartedAt: new Date(event.started_at),
            twitchStreamerData: streamerData,
            twitchStreamData: streamData,
            twitchStreamId: event.id,
          }).where(eq(tables.streamMessages.id, message.id)).returning({ id: tables.streamMessages.id }).get()

          updatedIds.push(updated.id)
        }

        this.streamMessages = await useDB(this.env).query.streamMessages.findMany({
          with: {
            stream: true,
            kickStream: true,
          },
          where: (messages, { inArray }) => inArray(messages.id, updatedIds),
        })
      }

      // Check if we can send any messages immediately
      if (this.streamMessages && this.streamMessages.length > 0) {
        const messagesToSendNow: StreamMessage[] = []
        const messagesToKeep: StreamMessage[] = []

        const kickStreams = await useDB(this.env).query.kickStreams.findMany({
          where: (streams, { like }) => like(streams.name, event.broadcaster_user_name),
        })

        for (const message of this.streamMessages) {
          const matchingKickStreams = kickStreams.filter(kickStream => kickStream.channelId === message.discordChannelId)

          if (matchingKickStreams.length === 0) {
            messagesToSendNow.push(message)
          }
          else {
            messagesToKeep.push(message)
          }
        }

        // Send immediate messages
        for (const message of messagesToSendNow) {
          await this.sendNotification(message)
        }

        // Keep remaining messages for later
        this.streamMessages = messagesToKeep.length > 0 ? messagesToKeep : null
      }
    }
    catch (error) {
      console.error('Error updating Twitch stream messages:', error)
    }
  }

  /**
   * Updates the stream messages for a Kick stream based on a 'livestream.status.updated' event.
   * If there are no existing stream messages, it creates new messages in the database for the
   * channel. If the array is not empty, it updates the existing messages. The function also checks
   * if any messages can be sent immediately and sends them if possible.
   *
   * @param payload - The payload containing the event data and subscription details.
   */

  async updateKickStreamMessages(payload: KickLivestreamStatusUpdatedEvent) {
    try {
      if (!this.streamMessages) {
        const broadcasterUserId = payload.broadcaster.user_id
        const broadcasterName = payload.broadcaster.channel_slug

        const subscriptions = await useDB(this.env).query.kickStreams.findMany({
          where: (kickStreams, { eq }) => eq(kickStreams.broadcasterId, String(broadcasterUserId)),
        })

        const [kickUser, kickLivestream] = await Promise.all([
          getKickChannelV2(broadcasterName),
          getKickLivestream(broadcasterUserId, this.env),
        ])

        const insertedIds: number[] = []

        for (const subscription of subscriptions) {
          const inserted = await useDB(this.env).insert(tables.streamMessages).values({
            discordChannelId: subscription.channelId,
            kickStreamId: subscription.id,
            kickOnline: true,
            kickStreamStartedAt: new Date(payload.started_at),
            kickStreamData: kickLivestream,
            kickStreamerData: kickUser,
          }).returning({ id: tables.streamMessages.id }).get()

          insertedIds.push(inserted.id)
        }

        this.streamMessages = await useDB(this.env).query.streamMessages.findMany({
          with: {
            stream: true,
            kickStream: true,
          },
          where: (messages, { inArray }) => inArray(messages.id, insertedIds),
        })
      }
      else {
        const broadcasterName = payload.broadcaster.channel_slug
        const broadcasterUserId = payload.broadcaster.user_id

        const [kickUser, kickLivestream] = await Promise.all([
          getKickChannelV2(broadcasterName),
          getKickLivestream(broadcasterUserId, this.env),
        ])

        const updatedIds: number[] = []
        const subscriptions = await useDB(this.env).query.kickStreams.findMany({
          where: (kickStreams, { eq }) => eq(kickStreams.broadcasterId, String(broadcasterUserId)),
        })
        for (const message of this.streamMessages ?? []) {
          const stream = subscriptions.find(sub => sub.channelId === message.discordChannelId)
          const updated = await useDB(this.env).update(tables.streamMessages).set({
            kickStreamId: stream?.id ?? 0,
            kickOnline: true,
            kickStreamStartedAt: new Date(payload.started_at),
            kickStreamData: kickLivestream,
            kickStreamerData: kickUser,
          }).where(eq(tables.streamMessages.id, message.id)).returning({ id: tables.streamMessages.id }).get()

          updatedIds.push(updated.id)
        }

        this.streamMessages = await useDB(this.env).query.streamMessages.findMany({
          with: {
            stream: true,
            kickStream: true,
          },
          where: (messages, { inArray }) => inArray(messages.id, updatedIds),
        })
      }

      // Check if we can send any messages immediately
      if (this.streamMessages && this.streamMessages.length > 0) {
        const messagesToSendNow: StreamMessage[] = []
        const messagesToKeep: StreamMessage[] = []

        const twitchStreams = await useDB(this.env).query.streams.findMany({
          where: (streams, { like }) => like(streams.name, payload.broadcaster.channel_slug),
        })

        for (const message of this.streamMessages) {
          const matchingTwitchStreams = twitchStreams.filter(twitchStream => twitchStream.channelId === message.discordChannelId)

          if (matchingTwitchStreams.length === 0) {
            messagesToSendNow.push(message)
          }
          else {
            messagesToKeep.push(message)
          }
        }

        // Send immediate messages
        for (const message of messagesToSendNow) {
          await this.sendNotification(message)
        }

        // Keep remaining messages for later
        this.streamMessages = messagesToKeep.length > 0 ? messagesToKeep : null
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
    this.streamMessages = null
    await this.clearAlarm()
    await this.saveState()
  }
}

type StreamHandlerParams
  = | { platform: 'twitch', payload: SubscriptionEventResponseData<SubscriptionType> }
    | { platform: 'kick', payload: KickLivestreamStatusUpdatedEvent }
