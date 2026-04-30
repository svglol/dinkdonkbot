import type { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataOption, APIMessageComponentInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { buildErrorEmbed, updateInteraction } from '@discord-api'
import { isGuildInteraction } from 'discord-api-types/utils'
import { ApplicationCommandOptionType } from 'discord-api-types/v10'
import { useDB } from '@/database/db'
import { deferedUpdate } from '@/discord/interactionHandler'
import { ordinal } from '@/utils/dates'

export const BIRTHDAYS_LIST_COMMAND = {
  type: 1,
  name: 'list',
  description: 'List all birthdays in this server',
  dm_permission: false,
}

const MAX_CONTENT_LENGTH = 10

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

interface BirthdayPageInfo {
  id: string
  title: string
  content: string
}

interface PaginatedPage extends BirthdayPageInfo {
  pageNumber: number
  totalPages: number
}

interface PageGroup {
  baseId: string
  title: string
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

function createPageGroup(pageInfo: BirthdayPageInfo): PageGroup {
  const contentPages = paginateContent(pageInfo.content)
  const pages: PaginatedPage[] = contentPages.map((content, index) => ({
    ...pageInfo,
    content,
    pageNumber: index + 1,
    totalPages: contentPages.length,
    id: `${pageInfo.id}_${index + 1}`,
  }))
  return { baseId: pageInfo.id, title: pageInfo.title, pages }
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
        custom_id: 'birthday_month_select',
        placeholder: `${currentGroup.title}${currentGroup.pages.length > 1 ? ` (${currentPageNumber}/${currentGroup.pages.length})` : ''}`,
        options: pageGroups.map(group => ({
          label: group.title,
          value: group.baseId,
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
          custom_id: 'birthday_prev_page',
          emoji: { name: '◀️' },
          disabled: currentPageNumber <= 1,
        },
        {
          type: 2,
          style: 2,
          custom_id: 'birthday_page_info',
          label: `${currentPageNumber} / ${currentGroup.pages.length}`,
          disabled: true,
        },
        {
          type: 2,
          style: 2,
          custom_id: 'birthday_next_page',
          emoji: { name: '▶️' },
          disabled: currentPageNumber >= currentGroup.pages.length,
        },
      ],
    }
    components.push(navButtons)
  }

  return components
}

async function getAllBirthdayPages(interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction, env: Env) {
  const serverId = interaction.guild_id
  const birthdays = await useDB(env).query.birthday.findMany({
    where: (birthday, { eq, and }) => and(eq(birthday.guildId, serverId!), eq(birthday.disabled, false)),
  })

  if (birthdays.length === 0)
    return []

  const byMonth: Record<number, typeof birthdays> = {}
  for (const birthday of birthdays) {
    const month = birthday.month - 1 // convert to 0-indexed
    if (!byMonth[month])
      byMonth[month] = []
    byMonth[month].push(birthday)
  }

  const pageInfos: BirthdayPageInfo[] = []
  for (let month = 0; month < 12; month++) {
    const entries = byMonth[month]
    if (!entries || entries.length === 0)
      continue

    const sorted = entries.sort((a, b) => a.day - b.day)
    const content = sorted.map(b => `- <@${b.userId}> — ${MONTH_NAMES[month]} ${ordinal(b.day)}`).join('\n')

    pageInfos.push({
      id: `page_month_${month}`,
      title: MONTH_NAMES[month],
      content,
    })
  }

  return pageInfos.map(createPageGroup)
}

async function listBirthdays(interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction, env: Env, pageId?: string) {
  const pageGroups = await getAllBirthdayPages(interaction, env)

  if (pageGroups.length === 0) {
    return updateInteraction(interaction, env, {
      embeds: [buildErrorEmbed('No birthdays registered in this server yet', env)],
    })
  }

  const currentPageId = pageId || pageGroups[0].pages[0].id
  const currentPage = getCurrentPage(pageGroups, currentPageId)!
  const components = createNavigationComponents(pageGroups, currentPageId)

  const birthdayCard = {
    type: 17,
    accent_color: 0xFF69B4,
    components: [
      {
        type: 10,
        content: `## 🎂 Server Birthdays\n### ${currentPage.title} (${currentPage.pageNumber}/${currentPage.totalPages})`,
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
    components: [birthdayCard],
  })
}

export async function handleBirthdaysListCommand(interaction: APIApplicationCommandInteraction, option: APIApplicationCommandInteractionDataOption, env: Env) {
  if (option.type !== ApplicationCommandOptionType.Subcommand)
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!isGuildInteraction(interaction))
    return updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })
  return listBirthdays(interaction, env)
}

export async function handleBirthdaysListMessageComponent(interaction: APIMessageComponentInteraction, env: Env, ctx: ExecutionContext) {
  const customId = interaction.data.custom_id
  const pageGroups = await getAllBirthdayPages(interaction, env)
  let pageId = pageGroups[0]?.pages[0]?.id || 'page_month_0_1'

  if (customId === 'birthday_month_select') {
    const selectedMonth = interaction.data.component_type === 3 ? interaction.data.values?.[0] : undefined
    if (selectedMonth)
      pageId = `${selectedMonth}_1`
  }
  else if (customId === 'birthday_prev_page' || customId === 'birthday_next_page') {
    const currentMessage = interaction.message
    if (currentMessage?.components) {
      const topComponent = currentMessage.components.find(row => row.type === 17)
      const dropdownRowComponent = topComponent?.components.find(comp => comp.type === 1)
      const dropdownComponent = dropdownRowComponent?.components.find(comp => comp.type === 3)

      if (dropdownComponent) {
        const selectedOption = dropdownComponent.options?.find(opt => opt.default)
        if (selectedOption) {
          const baseId = selectedOption.value
          const buttonsRow = topComponent?.components.find(row => row.type === 1 && row.components?.some(comp => comp.type === 2) && row.components.length > 0)
          if (buttonsRow && 'components' in buttonsRow) {
            const pageInfoComponent = buttonsRow.components.find(comp =>
              'custom_id' in comp && comp.type === 2 && comp.custom_id === 'birthday_page_info',
            )
            if (pageInfoComponent && 'label' in pageInfoComponent) {
              const [current, total] = pageInfoComponent.label!.split(' / ').map((n: string) => Number.parseInt(n))
              const newPage = customId === 'birthday_prev_page'
                ? Math.max(1, current - 1)
                : Math.min(total, current + 1)
              pageId = `${baseId}_${newPage}`
            }
          }
        }
      }
    }
  }

  ctx.waitUntil(listBirthdays(interaction, env, pageId))
  return deferedUpdate()
}
