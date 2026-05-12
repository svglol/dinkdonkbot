import type { APIEmbed } from 'discord-api-types/v10'

export function buildClipMessage(clips: {
  platform: 'kick' | 'twitch'
  channelUsername: string
  channelIcon?: string
  title: string
  clipUrl: string
  thumbnailUrl: string
  creatorUsername: string
  unixTimestamp: number
}[]) {
  const embeds = clips.map((clip) => {
    const isKick = clip.platform === 'kick'
    const accentColor = isKick ? 0x53FC18 : 0x6441A4
    return {
      title: clip.title,
      url: clip.clipUrl,
      color: accentColor,
      author: {
        name: `${clip.channelUsername}`,
        icon_url: clip.channelIcon || undefined,
      },
      thumbnail: { url: clip.thumbnailUrl },
      footer: {
        text: `Clipped by ${clip.creatorUsername}`,
      },
      timestamp: new Date(clip.unixTimestamp * 1000).toISOString(),
    } as APIEmbed
  })

  return {
    embeds,
  }
}
