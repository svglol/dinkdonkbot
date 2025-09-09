import type { APIApplicationCommandInteraction, APIMessageComponentInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { useDB } from '@database'
import { buildErrorEmbed, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { deferedUpdate } from '@/discord/interactionHandler'
import { KICK_EMOTE, TWITCH_EMOTE } from '@/utils/discordEmotes'

export const STREAM_LIST_COMMAND = {
  type: 1,
  name: 'list',
  description: 'View all of your Twitch/Kick stream notifications',
  dm_permission: false,
}

const MAX_CONTENT_LENGTH = 10

interface StreamPageInfo {
  id: string
  title: string
  emoji: { name: string, id?: string, animated?: boolean, formatted: string }
  content: string
}

interface PaginatedPage extends StreamPageInfo {
  pageNumber: number
  totalPages: number
}

interface PageGroup {
  baseId: string
  title: string
  emoji: { name: string, id?: string, animated?: boolean, formatted: string }
  pages: PaginatedPage[]
}

function paginateContent(content: string, maxLength = MAX_CONTENT_LENGTH): string[] {
  const lines = content.split('\n')
  const pages: string[] = []

  for (let i = 0; i < lines.length; i += maxLength) {
    const page = lines.slice(i, i + maxLength).join('\n').trim()
    if (page)
      pages.push(page)
  }

  return pages.length > 0 ? pages : [content]
}

function createPageGroup(pageInfo: StreamPageInfo): PageGroup {
  const contentPages = paginateContent(pageInfo.content)
  const pages: PaginatedPage[] = contentPages.map((content, index) => ({
    ...pageInfo,
    content,
    pageNumber: index + 1,
    totalPages: contentPages.length,
    id: `${pageInfo.id}_${index + 1}`,
  }))
  return {
    baseId: pageInfo.id,
    title: pageInfo.title,
    emoji: pageInfo.emoji,
    pages,
  }
}

function parsePageId(pageId: string): { baseId: string, pageNumber: number } {
  const parts = pageId.split('_')
  const pageNumber = Number.parseInt(parts[parts.length - 1]) || 1
  const baseId = parts.slice(0, -1).join('_')
  return { baseId, pageNumber }
}

function getCurrentPage(pageGroups: PageGroup[], pageId: string): PaginatedPage | null {
  const { baseId, pageNumber } = parsePageId(pageId)
  const group = pageGroups.find(g => g.baseId === baseId)
  if (!group)
    return null
  return group.pages.find(p => p.pageNumber === pageNumber) || group.pages[0] || null
}

function createNavigationComponents(pageGroups: PageGroup[], currentPageId: string) {
  const { baseId: currentBaseId, pageNumber: currentPageNumber } = parsePageId(currentPageId)
  const currentGroup = pageGroups.find(g => g.baseId === currentBaseId)
  if (!currentGroup)
    return []

  const dropdown: APIMessageTopLevelComponent = {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: 'stream_type_select',
        placeholder: `${currentGroup.title}${currentGroup.pages.length > 1 ? ` (${currentPageNumber}/${currentGroup.pages.length})` : ''}`,
        options: pageGroups.map(group => ({
          label: group.title,
          value: group.baseId,
          emoji: group.emoji,
          description: group.pages.length > 1 ? `${group.pages.length} pages` : undefined,
          default: group.baseId === currentBaseId,
        })),
      },
    ],
  }

  const components = [dropdown]

  if (currentGroup.pages.length > 1) {
    const navButtons: APIMessageTopLevelComponent = {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          custom_id: 'stream_prev_page',
          emoji: { name: '◀️' },
          disabled: currentPageNumber <= 1,
        },
        {
          type: 2,
          style: 2,
          custom_id: 'stream_page_info',
          label: `${currentPageNumber} / ${currentGroup.pages.length}`,
          disabled: true,
        },
        {
          type: 2,
          style: 2,
          custom_id: 'stream_next_page',
          emoji: { name: '▶️' },
          disabled: currentPageNumber >= currentGroup.pages.length,
        },
      ],
    }
    components.push(navButtons)
  }

  return components
}

async function getAllStreamPages(interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction, env: Env) {
  const db = useDB(env)
  const streams = await db.query.streams.findMany({
    where: (s, { eq }) => eq(s.guildId, interaction.guild_id || ''),
    with: { multiStream: { with: { kickStream: true, stream: true } } },
  })
  const kickStreams = await db.query.kickStreams.findMany({
    where: (s, { eq }) => eq(s.guildId, interaction.guild_id || ''),
    with: { multiStream: { with: { kickStream: true, stream: true } } },
  })

  const multistreams = streams.filter(s => s.multiStream).flatMap(s => s.multiStream)
  const twitchStreams = streams
  const soloKickStreams = kickStreams

  const pageInfos: StreamPageInfo[] = []

  if (multistreams.length > 0) {
    pageInfos.push({
      id: 'page_multistreams',
      title: 'Multistreams',
      emoji: { name: '🔗', formatted: TWITCH_EMOTE.formatted + KICK_EMOTE.formatted },
      content: multistreams.map(ms => `- ${TWITCH_EMOTE.formatted}**${ms.stream?.name}** + ${KICK_EMOTE.formatted}**${ms.kickStream?.name}** - <#${ms.stream?.channelId}>`).join('\n'),
    })
  }
  if (twitchStreams.length > 0) {
    pageInfos.push({
      id: 'page_twitch',
      title: 'Twitch Notifications',
      emoji: { name: TWITCH_EMOTE.name, id: TWITCH_EMOTE.id, formatted: TWITCH_EMOTE.formatted },
      content: twitchStreams.map(s => `- **${s.name}** - <#${s.channelId}>`).join('\n'),
    })
  }
  if (soloKickStreams.length > 0) {
    pageInfos.push({
      id: 'page_kick',
      title: 'Kick Notifications',
      emoji: { name: KICK_EMOTE.name, id: KICK_EMOTE.id, formatted: KICK_EMOTE.formatted },
      content: soloKickStreams.map(s => `- **${s.name}** - <#${s.channelId}>`).join('\n'),
    })
  }

  return pageInfos.map(createPageGroup)
}

export async function handleStreamListCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!isGuildInteraction(interaction)) {
    return updateInteraction(interaction, env, {
      embeds: [buildErrorEmbed('This command can only be used in a server', env)],
    })
  }
  return listStreams(interaction, env)
}

async function listStreams(interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction, env: Env, pageId?: string) {
  const pageGroups = await getAllStreamPages(interaction, env)
  if (pageGroups.length === 0) {
    return updateInteraction(interaction, env, {
      embeds: [buildErrorEmbed('No notifications set up yet', env)],
    })
  }

  const currentPageId = pageId || pageGroups[0].pages[0].id
  const currentPage = getCurrentPage(pageGroups, currentPageId)!
  const components = createNavigationComponents(pageGroups, currentPageId)

  const streamCard = {
    type: 17,
    accent_color: 0xFFF200,
    components: [
      {
        type: 10,
        content: `## Stream Notifications\n### ${currentPage.emoji.formatted} ${currentPage.title}`,
      },
      {
        type: 10,
        content: currentPage.content,
      },
      ...components,
    ],
  } satisfies APIMessageTopLevelComponent

  return updateInteraction(interaction, env, {
    flags: 1 << 15,
    components: [streamCard],
  })
}

export async function handleStreamListMessageComponent(interaction: APIMessageComponentInteraction, env: Env, ctx: ExecutionContext) {
  const customId = interaction.data.custom_id
  const pageGroups = await getAllStreamPages(interaction, env)
  let pageId = pageGroups[0]?.pages[0]?.id || 'page_multistreams_1'

  // Determine new page based on interaction type
  if (customId === 'stream_type_select') {
    const selectedType = interaction.data.component_type === 3 ? interaction.data.values?.[0] : undefined
    if (selectedType) {
      pageId = `${selectedType}_1`
    }
  }
  else if (customId === 'stream_prev_page' || customId === 'stream_next_page') {
    // Get current page from the interaction message components
    // We need to parse the current state from the message
    const currentMessage = interaction.message
    if (currentMessage?.components) {
      // Find the dropdown to get current type
      const topComponent = currentMessage.components.find(row => row.type === 17) // container
      const dropdownRowComponent = topComponent?.components.find(comp => comp.type === 1) // Get the action row containing only one component
      const dropdownComponent = dropdownRowComponent?.components.find(comp => comp.type === 3)

      if (dropdownComponent) {
        const selectedOption = dropdownComponent.options?.find(opt => opt.default)
        if (selectedOption) {
          const baseId = selectedOption.value

          // Find the page info button to get current page
          const buttonsRow = topComponent?.components.find(row => row.type === 1 && row.components?.some(comp => comp.type === 2) && row.components.length > 0)
          if (buttonsRow && 'components' in buttonsRow) {
            const pageInfoComponent = buttonsRow?.components.find(comp =>
              'custom_id' in comp && comp.type === 2 && comp.custom_id === 'stream_page_info',
            )

            if (pageInfoComponent && 'label' in pageInfoComponent) {
              const [current, total] = pageInfoComponent!.label!.split(' / ').map((n: string) => Number.parseInt(n))
              const newPage = customId === 'stream_prev_page'
                ? Math.max(1, current - 1)
                : Math.min(total, current + 1)
              pageId = `${baseId}_${newPage}`
            }
          }
        }
      }
    }
  }
  ctx.waitUntil(listStreams(interaction, env, pageId))
  return deferedUpdate()
}
