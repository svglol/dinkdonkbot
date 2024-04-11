declare global {
  interface Env {
    DB: D1Database
    KV: KVNamespace
    DISCORD_TOKEN: string
    DISCORD_PUBLIC_KEY: string
    DISCORD_APPLICATION_ID: string
    TWITCH_CLIENT_ID: string
    TWITCH_CLIENT_SECRET: string
    TWITCH_EVENT_SECRET: string
    WEBHOOK_URL: string
  }

  interface TwitchToken {
    access_token: string
    expires_in: number
    scope: string
    token_type: string
  }

  interface TwitchUserData {
    data: {
      id: string
      login: string
      display_name: string
      type: string
      broadcaster_type: string
      description: string
      profile_image_url: string
      offline_image_url: string
      view_count: number
      email: string
      created_at: string
    }[]
  }

  interface SubscriptionCondition {
    broadcaster_user_id?: string
    user_id?: string
    // Add more properties as needed based on possible conditions
  }

  // Interface for the transport object within each subscription
  interface SubscriptionTransport {
    method: string
    callback: string
  }

  // Interface for an individual subscription object
  interface Subscription {
    id: string
    status: string
    type: string
    version: string
    cost: number
    condition: SubscriptionCondition
    created_at: string
    transport: SubscriptionTransport
  }

  // Interface for the entire response object
  interface SubscriptionResponse {
    data: Subscription[]
    total: number
    total_cost: number
    max_total_cost: number
    pagination: Record<string, unknown> // Placeholder for pagination data
  }

  // Interface for the condition object within the subscription
  interface SubscriptionConditionData {
    broadcaster_user_id: string
  }

  // Interface for the transport object within the subscription
  interface SubscriptionTransportData {
    method: string
    callback: string
  }

  // Interface for the subscription object
  interface SubscriptionData {
    id: string
    type: string
    version: string
    status: string
    cost: number
    condition: SubscriptionConditionData
    transport: SubscriptionTransportData
    created_at: string
  }

  // Interface for the event object
  interface EventData {
    id: string
    broadcaster_user_id: string
    broadcaster_user_login: string
    broadcaster_user_name: string
    type: string
    started_at: string
  }

  // Interface for the entire response object
  interface SubscriptionEventResponseData {
    subscription: SubscriptionData
    event?: EventData
    challenge?: string
  }

  // Interface representing an option within a Discord interaction
  interface DiscordInteractionOption {
    name: string // Name of the option
    value: string | number | boolean // Value of the option (can be string, number, or boolean)
  }

  // Interface representing a sub-command within a Discord interaction
  interface DiscordSubCommand {
    name: string // Name of the sub-command
    options?: DiscordInteractionOption[] // Optional array of options for the sub-command
  }

  // Interface representing a top-level command or interaction
  interface DiscordInteraction {
    id: string // Unique ID of the interaction
    type: number // Type of interaction (1 for Ping, 2 for Application Command)
    data?: {
      name: string // Name of the invoked command or sub-command
      options?: DiscordInteractionOption[] | DiscordSubCommand[] // Options or sub-commands provided
    }
    guild_id: string // ID of the guild (server) where the interaction occurred
    channel_id: string // ID of the channel where the interaction occurred
    member?: DiscordInteractionMember // Information about the member who issued the interaction
    token: string // Token used to respond to the interaction
  }

  // Interface representing a member in a Discord interaction
  interface DiscordInteractionMember {
    user: {
      id: string // ID of the user
      username: string // Username of the user
      discriminator: string // Discriminator of the user (e.g., #1234)
      avatar: string | null // Avatar URL of the user (or null if no avatar)
    }
    roles: string[] // Array of role IDs assigned to the member
    permissions: string // Permissions of the member in the guild
    // Add more properties as needed to represent member information
  }

  interface TwitchStreamResponse {
    data: TwitchStream[]
  }

  interface TwitchStream {
    id: string
    user_id: string
    user_login: string
    user_name: string
    game_id: string
    game_name: string
    type: string // Assuming 'type' can be 'live' or 'vod' (video on demand), adjust as needed
    title: string
    tags: string[] // Assuming 'tags' are strings
    viewer_count: number
    started_at: string // ISO 8601 date-time string
    language: string
    thumbnail_url: string // Placeholder URL with {width}x{height} variables
    tag_ids: string[] // Assuming 'tag_ids' are strings
    is_mature: boolean
  }

}

export {}
