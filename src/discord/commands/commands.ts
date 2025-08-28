import type { APIApplicationCommand, APIApplicationCommandInteraction, APIMessageComponentInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { buildErrorEmbed, fetchBotCommands, updateInteraction } from '../discord'
import { deferedUpdate, interactionEphemeralLoading } from '../interactionHandler'

const COMMANDS_COMMAND = {
  name: 'commands',
  description: 'List all commands for DinkDonk Bot',
}

const MAX_CONTENT_LENGTH = 2000 // Safe limit for card content

interface PageInfo {
  id: string
  title: string
  emoji: string
  content: string
}

interface PaginatedPage {
  id: string
  title: string
  emoji: string
  content: string
  pageNumber: number
  totalPages: number
}

interface PageGroup {
  baseId: string
  title: string
  emoji: string
  pages: PaginatedPage[]
}

/**
 * Handles the /commands command.
 */
async function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(listCommands(interaction, env))
  return interactionEphemeralLoading()
}

function formatSlashCommand(command: APIApplicationCommand): string {
  const lines: string[] = []

  // Top-level command
  lines.push(`- </${command.name}:${command.id}> - ${command.description}`)

  if (command.options && command.options.length > 0) {
    command.options.forEach((option) => {
      if (option.type === 1) {
        // Subcommand
        lines.push(`   - </${command.name} ${option.name}:${command.id}> - ${option.description}`)
      }
      else if (option.type === 2 && option.options) {
        // Subcommand group
        lines.push(`  - **${option.name}** - ${option.description}`)
        option.options.forEach((sub) => {
          if (sub.type === 1) {
            lines.push(
              `     - </${command.name} ${option.name} ${sub.name}:${command.id}> - ${sub.description}`,
            )
          }
        })
      }
    })
  }

  return lines.join('\n')
}

/**
 * Splits content into pages based on character limit
 */
function paginateContent(content: string, maxLength: number = MAX_CONTENT_LENGTH): string[] {
  if (content.length <= maxLength) {
    return [content]
  }

  const pages: string[] = []
  const lines = content.split('\n')
  let currentPage = ''

  for (const line of lines) {
    const testContent = currentPage ? `${currentPage}\n${line}` : line

    if (testContent.length > maxLength && currentPage) {
      // Current page is full, start a new one
      pages.push(currentPage.trim())
      currentPage = line
    }
    else {
      currentPage = testContent
    }
  }

  if (currentPage.trim()) {
    pages.push(currentPage.trim())
  }

  return pages.length > 0 ? pages : [content]
}

function createPageGroup(pageInfo: PageInfo): PageGroup {
  const contentPages = paginateContent(pageInfo.content)

  const pages: PaginatedPage[] = contentPages.map((content, index) => ({
    id: `${pageInfo.id}_${index + 1}`,
    title: pageInfo.title,
    emoji: pageInfo.emoji,
    content,
    pageNumber: index + 1,
    totalPages: contentPages.length,
  }))

  return {
    baseId: pageInfo.id,
    title: pageInfo.title,
    emoji: pageInfo.emoji,
    pages,
  }
}

async function getBaseCommandPages(env: Env): Promise<PageInfo[]> {
  const commands = await fetchBotCommands(env.DISCORD_TOKEN, env)
  const slashCommands = commands.filter(c => c.type === 1).sort((a, b) => a.name.localeCompare(b.name))
  const userCommands = commands.filter(c => c.type === 2).sort((a, b) => a.name.localeCompare(b.name))
  const messageCommands = commands.filter(c => c.type === 3).sort((a, b) => a.name.localeCompare(b.name))

  const basePages: PageInfo[] = [
    {
      id: 'page_overview',
      title: 'Overview',
      emoji: '📖',
      content: `### 💬 Slash Commands
Interactive commands you can use with \`/\` in Discord.
${slashCommands.length} command${slashCommands.length !== 1 ? 's' : ''} available.
${userCommands.length > 0
  ? `### 👤 User Commands
Right-click context menu commands for users.
${userCommands.length} command${userCommands.length !== 1 ? 's' : ''} available.`
  : ''}
${messageCommands.length > 0
  ? `### 📝 Message Commands  
Right-click context menu commands for messages.
${messageCommands.length} command${messageCommands.length !== 1 ? 's' : ''} available.`
  : ''}

-# Use the dropdown to select a category and navigation arrows to browse pages.`,
    },
  ]

  // Add slash commands page
  if (slashCommands.length > 0) {
    basePages.push({
      id: 'page_slash',
      title: 'Slash Commands',
      emoji: '💬',
      content: `${slashCommands.map(formatSlashCommand).join('\n')}`,
    })
  }

  // Add user commands page
  if (userCommands.length > 0) {
    basePages.push({
      id: 'page_user',
      title: 'User Commands',
      emoji: '👤',
      content: `Right-click on any user and select "Apps" to access these commands:\n${userCommands.map(c => `- **${c.name}**`).join('\n')}`,
    })
  }

  // Add message commands page
  if (messageCommands.length > 0) {
    basePages.push({
      id: 'page_message',
      title: 'Message Commands',
      emoji: '📝',
      content: `Right-click on any message and select "Apps" to access these commands:\n${messageCommands.map(c => `- **${c.name}**`).join('\n')}`,
    })
  }

  return basePages
}

async function getAllPageGroups(env: Env): Promise<PageGroup[]> {
  const basePages = await getBaseCommandPages(env)
  return basePages.map(createPageGroup)
}

function parsePageId(pageId: string): { baseId: string, pageNumber: number } {
  const parts = pageId.split('_')
  const pageNumber = Number.parseInt(parts[parts.length - 1]) || 1
  const baseId = parts.slice(0, -1).join('_')
  return { baseId, pageNumber }
}

function createNavigationComponents(pageGroups: PageGroup[], currentPageId: string) {
  const { baseId: currentBaseId, pageNumber: currentPageNumber } = parsePageId(currentPageId)
  const currentGroup = pageGroups.find(g => g.baseId === currentBaseId)

  if (!currentGroup) {
    return []
  }

  // Dropdown for page type selection
  const dropdown: APIMessageTopLevelComponent = {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: 'commands_type_select',
        placeholder: `${currentGroup.title}${currentGroup.pages.length > 1 ? ` (${currentPageNumber}/${currentGroup.pages.length})` : ''}`,
        options: pageGroups.map(group => ({
          label: group.title,
          value: group.baseId,
          emoji: { name: group.emoji },
          description: group.pages.length > 1 ? `${group.pages.length} pages` : undefined,
          default: group.baseId === currentBaseId,
        })),
      },
    ],
  }

  const components = [dropdown]

  // Add navigation arrows if there are multiple pages in current group
  if (currentGroup.pages.length > 1) {
    const navButtons: APIMessageTopLevelComponent = {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          custom_id: 'commands_prev_page',
          emoji: { name: '◀️' },
          disabled: currentPageNumber <= 1,
        },
        {
          type: 2,
          style: 2,
          custom_id: 'commands_page_info',
          label: `${currentPageNumber} / ${currentGroup.pages.length}`,
          disabled: true,
        },
        {
          type: 2,
          style: 2,
          custom_id: 'commands_next_page',
          emoji: { name: '▶️' },
          disabled: currentPageNumber >= currentGroup.pages.length,
        },
      ],
    }
    components.push(navButtons)
  }

  return components
}

function getCurrentPage(pageGroups: PageGroup[], pageId: string): PaginatedPage | null {
  const { baseId, pageNumber } = parsePageId(pageId)
  const group = pageGroups.find(g => g.baseId === baseId)
  if (!group)
    return null

  return group.pages.find(p => p.pageNumber === pageNumber) || group.pages[0] || null
}

async function listCommands(interaction: APIApplicationCommandInteraction | APIMessageComponentInteraction, env: Env, pageId: string = 'page_overview_1') {
  try {
    const pageGroups = await getAllPageGroups(env)
    const currentPage = getCurrentPage(pageGroups, pageId)

    if (!currentPage) {
      return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
        embeds: [buildErrorEmbed('Page not found', env)],
      })
    }

    const navigationComponents = createNavigationComponents(pageGroups, pageId)

    const commandsCard = {
      type: 17,
      accent_color: 0xFFF200,
      components: [
        {
          type: 9,
          components: [
            {
              type: 10,
              content: `## DinkDonk Bot Commands\n## ${currentPage.emoji} ${currentPage.title}\n-# ${currentPage.pageNumber} / ${currentPage.totalPages}`,
            },
            {
              type: 10,
              content: currentPage.content,
            },
          ],
          accessory: {
            type: 11,
            media: {
              url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
            },
          },
        },
        ...navigationComponents,
      ],
    } satisfies APIMessageTopLevelComponent

    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      flags: 1 << 15,
      components: [commandsCard],
    })
  }
  catch (error) {
    console.error('Error listing commands:', error)
    return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
      embeds: [buildErrorEmbed('Failed to fetch commands', env)],
    })
  }
}

export async function handleCommandsMessageComponent(interaction: APIMessageComponentInteraction, env: Env, ctx: ExecutionContext) {
  const customId = interaction.data.custom_id
  let pageId = 'page_overview_1'

  if (customId === 'commands_type_select') {
    // Dropdown selection - switch to first page of selected type
    const selectedType = interaction.data.component_type === 3 ? interaction.data.values?.[0] : undefined
    if (selectedType) {
      pageId = `${selectedType}_1`
    }
  }
  else if (customId === 'commands_prev_page' || customId === 'commands_next_page') {
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
              'custom_id' in comp && comp.type === 2 && comp.custom_id === 'commands_page_info',
            )

            if (pageInfoComponent && 'label' in pageInfoComponent) {
              const [current, total] = pageInfoComponent!.label!.split(' / ').map((n: string) => Number.parseInt(n))
              const newPage = customId === 'commands_prev_page'
                ? Math.max(1, current - 1)
                : Math.min(total, current + 1)
              pageId = `${baseId}_${newPage}`
            }
          }
        }
      }
    }
  }
  ctx.waitUntil(listCommands(interaction, env, pageId))
  return deferedUpdate()
}

export async function listAllBotCommands(interaction: APIApplicationCommandInteraction, env: Env) {
  return listCommands(interaction, env)
}

export default {
  command: COMMANDS_COMMAND,
  handler,
  messageComponentHandlers: {
    commands_type_select: handleCommandsMessageComponent,
    commands_prev_page: handleCommandsMessageComponent,
    commands_next_page: handleCommandsMessageComponent,
  },
} satisfies DiscordAPIApplicationCommand
