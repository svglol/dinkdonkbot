declare global {
  interface Env {
    DB: D1Database
    KV: KVNamespace
    ASSETS: Fetcher
    DISCORD_TOKEN: string
    DISCORD_PUBLIC_KEY: string
    DISCORD_APPLICATION_ID: string
    TWITCH_CLIENT_ID: string
    TWITCH_CLIENT_SECRET: string
    TWITCH_EVENT_SECRET: string
    WEBHOOK_URL: string
    KICK_CLIENT_ID: string
    KICK_CLIENT_SECRET: string
  }

  interface TwitchToken {
    access_token: string
    expires_in: number
    scope: string
    token_type: string
  }

  interface KickToken {
    access_token: string
    expires_in: string
    token_type: string
  }

  interface KVDiscordMessage {
    streamId: string
    messages: { messageId: string, channelId: string, embed: DiscordEmbed, dbStreamId: number }[]
  }

  interface TwitchUserData {
    data: TwitchUser[]
  }

  interface TwitchUser {
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
      resolved?: {
        messages?: Record<string, {
          id: string
          channel_id: string
          content: string
          sticker_items?: {
            id: string
            name: string
            format_type: number
          }[]
        }>
      }
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

  interface TwitchClipsResponse {
    data: TwitchClip[]
  }

  interface TwitchClip {
    id: string
    url: string
    embed_url: string
    broadcaster_id: string
    broadcaster_name: string
    creator_id: string
    creator_name: string
    video_id: string
    game_id: string
    language: string
    title: string
    view_count: number
    created_at: string
    thumbnail_url: string
    duration: number
    vod_offset: number | null
    is_featured: boolean
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

  interface DiscordBody {
    content?: string
    embeds?: DiscordEmbed[]
    components?: DiscordComponent[]
  }

  interface KickLivestreamStatusUpdatedEvent {
    broadcaster: {
      is_anonymous: boolean
      user_id: number
      username: string
      is_verified: boolean
      profile_picture: string
      channel_slug: string
      identity: null | unknown
    }
    is_live: boolean
    title: string
    started_at: string
    ended_at: string
  }

  interface KickChannelsResponse {
    data: KickChannel[]
    message: string
  }
  interface KickWebhooksResponse {
    data: KickWebhookData[]
    message: string
  }

  interface KickWebhookData {
    app_id: string
    broadcaster_user_id: number
    created_at: string
    event: string
    id: string
    method: string
    updated_at: string
    version: number
  }

  interface KickChannel {
    banner_picture: string
    broadcaster_user_id: number
    category: KickCategory
    channel_description: string
    slug: string
    stream: KickStream
    stream_title: string
  }

  interface KickCategory {
    id: number
    name: string
    thumbnail: string
  }

  interface KickStream {
    is_live: boolean
    is_mature: boolean
    key: string
    language: string
    start_time: string
    thumbnail: string
    url: string
    viewer_count: number
  }

  interface KickLivestreamStatusUpdatedEvent {
    broadcaster: {
      is_anonymous: boolean
      user_id: number
      username: string
      is_verified: boolean
      profile_picture: string
      channel_slug: string
      identity: null | unknown
    }
    is_live: boolean // true when live, false when ended
    title: string
    started_at: string // ISO 8601 timestamp
    ended_at: string | null // null when live, timestamp when ended
  }

  export interface KickLiveStream {
    broadcaster_user_id: number
    category: KickCategory
    channel_id: number
    has_mature_content: boolean
    language: string
    slug: string
    started_at: string
    stream_title: string
    thumbnail: string
    viewer_count: number
  }

  export interface KickLiveStreamResponse {
    data: KickLiveStream[]
  }

  export interface KickUser {
    email: string
    name: string
    profile_picture: string
    user_id: number
  }

  export interface KickUserResponse {
    data: KickUser[]
    message: string
  }

  export interface KickChannelV2 {
    id: number
    user_id: number
    slug: string
    is_banned: boolean
    playback_url: string
    vod_enabled: boolean
    subscription_enabled: boolean
    is_affiliate: boolean
    followers_count: number
    subscriber_badges: any[] // If you know the structure, replace `any` with a specific type
    banner_image: {
      url: string
    } | null
    livestream: any | null // Replace with actual type if available
    role: any | null
    muted: boolean
    follower_badges: any[] // Same as above
    offline_banner_image: {
      src: string
      srcset: string
    }
    verified: boolean
    recent_categories: any[] // Replace with actual type if known
    can_host: boolean
    user: {
      id: number
      username: string
      agreed_to_terms: boolean
      email_verified_at: string
      bio: string
      country: string
      state: string
      city: string
      instagram: string
      twitter: string
      youtube: string
      discord: string
      tiktok: string
      facebook: string
      profile_pic: string
    }
    chatroom: {
      id: number
      chatable_type: string
      channel_id: number
      created_at: string
      updated_at: string
      chat_mode_old: string
      chat_mode: string
      slow_mode: boolean
      chatable_id: number
      followers_mode: boolean
      subscribers_mode: boolean
      emotes_mode: boolean
      message_interval: number
      following_min_duration: number
    }
  }
}

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}
export {}
