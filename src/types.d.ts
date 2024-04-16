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

  interface KVDiscordMessage {
    streamId: string
    messages: { messageId: string, channelId: string, embed: DiscordEmbed, dbStreamId: number }[]
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
  }

  interface SubscriptionTransport {
    method: string
    callback: string
  }

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

  interface SubscriptionResponse {
    data: Subscription[]
    total: number
    total_cost: number
    max_total_cost: number
    pagination: Record<string, unknown>
  }

  interface SubscriptionConditionData {
    broadcaster_user_id: string
  }

  interface SubscriptionTransportData {
    method: string
    callback: string
  }

  enum SubscriptionType {
    Online = 'stream.online',
    Offline = 'stream.offline',
  }

  interface SubscriptionData {
    id: string
    type: 'stream.online' | 'stream.offline'
    version: string
    status: string
    cost: number
    condition: SubscriptionConditionData
    transport: SubscriptionTransportData
    created_at: string
  }

  interface OnlineEventData {
    id: string
    broadcaster_user_id: string
    broadcaster_user_login: string
    broadcaster_user_name: string
    type: string
    started_at: string
  }

  interface OfflineEventData {
    broadcaster_user_id: string
    broadcaster_user_login: string
    broadcaster_user_name: string
  }
  type SubscriptionEventByType<T extends SubscriptionType> = T extends SubscriptionType.Online
    ? OnlineEventData
    : T extends SubscriptionType.Offline
      ? OfflineEventData
      : never

  interface SubscriptionEventResponseData<T extends SubscriptionType> {
    subscription: SubscriptionData
    event?: SubscriptionEventByType<T>
    challenge?: string
  }

  interface DiscordInteractionOption {
    name: string
    value: string | number | boolean
  }

  interface DiscordSubCommand {
    name: string
    options?: DiscordInteractionOption[]
  }

  interface DiscordInteraction {
    id: string
    type: number
    data?: {
      name: string
      options?: DiscordInteractionOption[] | DiscordSubCommand[]
    }
    guild_id: string
    channel_id: string
    member?: DiscordInteractionMember
    token: string
  }

  interface DiscordInteractionMember {
    user: {
      id: string
      username: string
      discriminator: string
      avatar: string | null
    }
    roles: string[]
    permissions: string
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
    type: string
    title: string
    tags: string[]
    viewer_count: number
    started_at: string
    language: string
    thumbnail_url: string
    tag_ids: string[]
    is_mature: boolean
  }

  interface DiscordEmbed {
    title: string
    color?: number
    description?: string
    fields?: {
      name: string
      value: string
    }[]
    url?: string
    image?: {
      url: string
    }
    thumbnail?: {
      url: string
    }
    timestamp?: string
    footer?: {
      text: string
      iconURL?: string
    }
    author?: {
      name: string
      url?: string
      iconURL?: string
    }
    video?: {
      url: string
    }
    provider?: {
      name?: string
      url?: string
    }
    type?: 'rich' | 'image' | 'video' | 'gifv' | 'article' | 'link'
    files?: {
      name: string
      url: string
    }[]
  }

  interface DiscordComponent {
    type: DiscordComponentType
    components?: DiscordComponentData[]
    custom_id?: string
    disabled?: boolean
    placeholder?: string
    min_values?: number
    max_values?: number
  }

  interface DiscordComponentData {
    type: DiscordComponentType
    label?: string
    style?: DiscordButtonStyle
    emoji?: DiscordEmoji
    custom_id?: string
    url?: string
    options?: DiscordComponentOption[]
    placeholder?: string
    min_values?: number
    max_values?: number
  }

  interface DiscordComponentOption {
    label: string
    value: string
    description?: string
    emoji?: DiscordEmoji
    default?: boolean
  }

  interface DiscordEmoji {
    id?: string
    name?: string
    animated?: boolean
  }

  enum DiscordComponentType {
    ActionRow = 1,
    Button = 2,
    StringSelect = 3,
    TextInput = 4,
    UserSelect = 5,
    RoleSelect = 6,
    MentionableSelect = 7,
    ChannelSelect = 8,
  }

  enum DiscordButtonStyle {
    Primary = 1,
    Secondary = 2,
    Success = 3,
    Danger = 4,
    Link = 5,
  }

  interface MutedSegment {
    duration: number
    offset: number
  }

  interface VideoData {
    id: string
    stream_id: string | null
    user_id: string
    user_login: string
    user_name: string
    title: string
    description: string
    created_at: string
    published_at: string
    url: string
    thumbnail_url: string
    viewable: string
    view_count: number
    language: string
    type: string
    duration: string
    muted_segments: MutedSegment[]
  }

  interface PaginationData {
  }

  interface VideoResponseData {
    data: VideoData[]
    pagination: PaginationData
  }
}

export {}
