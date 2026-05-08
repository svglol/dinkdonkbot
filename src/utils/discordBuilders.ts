import { CLIPPERS_EMOTE, KICK_EMOTE, TWITCH_EMOTE } from '@/utils/discordEmotes'

export function buildClipMessage(clips: {
  platform: 'kick' | 'twitch'
  channelUsername: string
  title: string
  clipUrl: string
  thumbnailUrl: string
  creatorUsername: string
  unixTimestamp: number
}[]) {
  const removeEmojis = (str: string) => str.replace(/[^\w\s.,!?'\-":;()&%$#@]/g, '')

  const sections = clips.map((clip) => {
    const cleanTitle = removeEmojis(clip.title)
    const isKick = clip.platform === 'kick'
    const accentColor = isKick ? 0x53FC18 : 0x6441A4
    const platformLabel = isKick ? KICK_EMOTE.formatted : TWITCH_EMOTE.formatted

    return {
      type: 17,
      accent_color: accentColor,
      components: [
        {
          type: 9,
          components: [
            {
              type: 10,
              content: `${CLIPPERS_EMOTE.formatted}${platformLabel} **${clip.channelUsername}**`,
            },
            {
              type: 10,
              content: `### [${cleanTitle}](${clip.clipUrl})`,
            },
            {
              type: 10,
              content: [
                `-# 🎬 Clipped by \`${clip.creatorUsername}\``,
                `-# 🕐 <t:${clip.unixTimestamp}:F>`,
              ].join('\n'),
            },
          ],
          accessory: {
            type: 11,
            media: { url: clip.thumbnailUrl },
            description: `${clip.channelUsername} clip thumbnail`,
          },
        },
      ],
    }
  })

  return {
    flags: 1 << 15,
    components: sections,
  }
}
