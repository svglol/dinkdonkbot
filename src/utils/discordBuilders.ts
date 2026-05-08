import { CLIPPERS_EMOTE, KICK_EMOTE, TWITCH_EMOTE } from '@/utils/discordEmotes'

export function buildClipMessage(
  platform: 'kick' | 'twitch',
  channelUsername: string,
  title: string,
  clipUrl: string,
  thumbnailUrl: string,
  creatorUsername: string,
  unixTimestamp: number,
) {
  const removeEmojis = (str: string) => str.replace(/[^\w\s.,!?'\-":;()&%$#@]/g, '')
  const cleanTitle = removeEmojis(title)

  const isKick = platform === 'kick'
  const accentColor = isKick ? 0x53FC18 : 0x6441A4
  const platformLabel = isKick ? KICK_EMOTE.formatted : TWITCH_EMOTE.formatted
  return {
    flags: 1 << 15,
    components: [
      {
        type: 17,
        accent_color: accentColor,
        components: [
          {
            type: 9,
            components: [
              {
                type: 10,
                content: `${CLIPPERS_EMOTE.formatted}${platformLabel} **${channelUsername}**`,
              },
              {
                type: 10,
                content: `### [${cleanTitle}](${clipUrl})`,
              },
              {
                type: 10,
                content: [
                  `-# 🎬 Clipped by \`${creatorUsername}\``,
                  `-# 🕐 <t:${unixTimestamp}:F>`,
                ].join('\n'),
              },
            ],
            accessory: {
              type: 11,
              media: { url: thumbnailUrl },
              description: `${channelUsername} clip thumbnail`,
            },
          },
        ],
      },
    ],
  }
}
