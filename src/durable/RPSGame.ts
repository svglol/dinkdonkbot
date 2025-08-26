import type { APIApplicationCommandInteraction, APIComponentInContainer, APIMessageComponentInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { DurableObject } from 'cloudflare:workers'
import { isChatInputApplicationCommandInteraction, isGuildInteraction, isMessageComponentInteraction } from 'discord-api-types/utils'
import { buildErrorEmbed, findBotCommandMarkdown, updateInteraction } from '../discord/discord'
import { deferedUpdate, interactionEphemeralLoading } from '../discord/interactionHandler'

interface PersistedState {
  interaction: APIApplicationCommandInteraction | null
  playerA: string | null
  playerB: string | null
  playerAChoice: string | null
  playerBChoice: string | null
  playerAScore: number
  playerBScore: number
  alarmScheduled: boolean
}
const ALARM_TIME = 60000 // 60 seconds

export class RPSGame extends DurableObject {
  state: DurableObjectState
  env: Env

  // In-memory state (will be synced with persistent state)
  private interaction: APIApplicationCommandInteraction | null = null
  private playerA: string | null = null
  private playerB: string | null = null
  private playerAChoice: string | null = null
  private playerBChoice: string | null = null
  private playerAScore: number = 0
  private playerBScore: number = 0
  private alarmScheduled: boolean = false

  /**
   * Initializes a new RPSGame durable object.
   * @param state The underlying durable object state
   * @param env The environment variables for accessing configuration and services
   *
   * When constructed, the state is loaded from storage using {@link loadState}
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

  private async loadState(): Promise<void> {
    try {
      const persistedState = await this.state.storage.get<PersistedState>('RPSGame')

      if (persistedState) {
        this.interaction = persistedState.interaction
        this.playerA = persistedState.playerA
        this.playerB = persistedState.playerB
        this.playerAChoice = persistedState.playerAChoice
        this.playerBChoice = persistedState.playerBChoice
        this.playerAScore = persistedState.playerAScore
        this.playerBScore = persistedState.playerBScore
        this.alarmScheduled = persistedState.alarmScheduled
      }
    }
    catch (error) {
      console.error('Failed to load persisted state:', error)
    }
  }

  private async saveState(): Promise<void> {
    try {
      const stateToSave: PersistedState = {
        interaction: this.interaction,
        playerA: this.playerA,
        playerB: this.playerB,
        playerAChoice: this.playerAChoice,
        playerBChoice: this.playerBChoice,
        playerAScore: this.playerAScore,
        playerBScore: this.playerBScore,
        alarmScheduled: this.alarmScheduled,
      }

      await this.state.storage.put('RPSGame', stateToSave)
    }
    catch (error) {
      console.error('Failed to save state:', error)
    }
  }

  async alarm(): Promise<void> {
    try {
      this.alarmScheduled = false
      const RPSCard = this.buildComponents(false, false, true)

      if (this.interaction) {
        await updateInteraction(this.interaction, this.env.DISCORD_APPLICATION_ID, {
          flags: 1 << 15,
          components: [RPSCard],
        })
      }

      await this.reset()
    }
    catch (error) {
      console.error('Error in alarm:', error)
    }
  }

  private async scheduleAlarm(): Promise<void> {
    if (this.alarmScheduled) {
      return
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

  private async reset(): Promise<void> {
    this.interaction = null
    this.playerA = null
    this.playerB = null
    this.playerAChoice = null
    this.playerBChoice = null
    this.playerAScore = 0
    this.playerBScore = 0
    await this.clearAlarm()
    await this.saveState()
    await this.state.storage.deleteAll()
  }

  async startGame(interaction: APIApplicationCommandInteraction) {
    this.interaction = interaction
    if (!isGuildInteraction(interaction))
      return await updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', this.env)] })
    if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction) || !interaction.data.options)
      return await updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', this.env)] })

    this.playerA = interaction.member.user.id

    // get other player
    const opponent = interaction.data.options.find(option => option.name === 'opponent')
    if (!opponent || !('value' in opponent))
      return await updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Failed to get opponent', this.env)] })
    this.playerB = String(opponent.value).match(/\d+/)?.[0] ?? null
    if (!this.playerB)
      return await updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Failed to get opponent', this.env)] })

    if (this.playerB === this.playerA)
      return await updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('You cannot play against yourself', this.env)] })

    // if its the bot
    if (this.playerB === this.env.DISCORD_APPLICATION_ID) {
      const choices = ['Rock', 'Paper', 'Scissors']
      this.playerBChoice = choices[Math.floor(Math.random() * choices.length)]
    }
    await this.scheduleAlarm()
    await this.saveState()

    const RPSCard = this.buildComponents(true, false)

    return updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, {
      flags: 1 << 15,
      components: [RPSCard],
    })
  }

  async playerMove(interaction: APIMessageComponentInteraction) {
    if (!isGuildInteraction(interaction))
      return deferedUpdate()
    if (!interaction.data || !isMessageComponentInteraction(interaction))
      return deferedUpdate()

    if (interaction.member.user.id !== this.playerB && interaction.member.user.id !== this.playerA) {
      this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`This is not your game!\n If you want to challenge someone else, use the ${await findBotCommandMarkdown(this.env, 'rps')} command`, this.env)] }))
      return interactionEphemeralLoading()
    }

    if (interaction.member.user.id === this.playerA) {
      this.playerAChoice = interaction.data.component_type === 3 ? interaction.data.values?.[0] : null
    }
    if (interaction.member.user.id === this.playerB) {
      this.playerBChoice = interaction.data.component_type === 3 ? interaction.data.values?.[0] : null
    }

    await this.saveState()
    if (!this.playerAChoice || !this.playerBChoice) {
      // still waiting for both players to make a move (but we update the ui anyway)
      const RPSCard = this.buildComponents(true, false)
      this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, {
        flags: 1 << 15,
        components: [RPSCard],
      }))
      return deferedUpdate()
    }

    await this.clearAlarm()
    const winner = this.determineWinner(this.playerAChoice!, this.playerBChoice!)
    this.playerAScore += winner === 'A' ? 1 : 0
    this.playerBScore += winner === 'B' ? 1 : 0

    const RPSCard = this.buildComponents(false, true)

    this.playerAChoice = null
    this.playerBChoice = null
    await this.scheduleAlarm()
    await this.saveState()

    this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, {
      flags: 1 << 15,
      components: [RPSCard],
    }))

    return deferedUpdate()
  }

  async rematch(interaction: APIMessageComponentInteraction) {
    if (!isGuildInteraction(interaction))
      return deferedUpdate()
    if (!interaction.data || !isMessageComponentInteraction(interaction))
      return deferedUpdate()
    if (interaction.member.user.id !== this.playerB && interaction.member.user.id !== this.playerA) {
      this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`This is not your game!\n If you want to challenge someone else, use the ${await findBotCommandMarkdown(this.env, 'rps')} command`, this.env)] }))
      return interactionEphemeralLoading()
    }

    this.playerAChoice = null
    this.playerBChoice = null

    // If its the bot we set the choice for it
    if (this.playerB === this.env.DISCORD_APPLICATION_ID) {
      const choices = ['Rock', 'Paper', 'Scissors']
      this.playerBChoice = choices[Math.floor(Math.random() * choices.length)]
    }
    await this.clearAlarm()
    await this.scheduleAlarm()
    const rpsCard = this.buildComponents(true, false)
    this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, {
      components: [rpsCard],
      flags: 1 << 15,
    }))
    return deferedUpdate()
  }

  buildComponents(includeMoveSelect: boolean = false, includeRematch: boolean = false, timeout: boolean = false) {
    const containerComponents: APIComponentInContainer[] = []

    containerComponents.push({
      type: 10,
      content: '## RPS ✊✋✌️',
    })

    if (this.playerAScore > 0 || this.playerBScore > 0) {
      containerComponents.push({
        type: 10,
        content: `### ${timeout ? 'Final ' : ''} Score: <@${this.playerA}> **${this.playerAScore}** - **${this.playerBScore}** <@${this.playerB}>`,
      })
    }
    else {
      containerComponents.push({
        type: 10,
        content: `### <@${this.playerA}> has challenged <@${this.playerB}>!`,
      })
    }

    if (includeMoveSelect && (!this.playerAChoice || !this.playerBChoice)) {
      const waitingPlayers: string[] = []

      if (!this.playerAChoice && this.playerA)
        waitingPlayers.push(`<@${this.playerA}>`)
      if (!this.playerBChoice && this.playerB)
        waitingPlayers.push(`<@${this.playerB}>`)
      containerComponents.push({
        type: 10,
        content: `⏳ Waiting for ${waitingPlayers.join(' & ')} to select a move...`,
      })
      containerComponents.push({
        type: 1,
        components: [
          {
            type: 3,
            custom_id: 'rps_move_select',
            placeholder: 'Select a move',
            options: [
              { label: 'Rock', value: 'Rock', emoji: { name: '✊' } },
              { label: 'Paper', value: 'Paper', emoji: { name: '✋' } },
              { label: 'Scissors', value: 'Scissors', emoji: { name: '✌️' } },
            ],
          },
        ],
      })
    }

    if (includeRematch && this.playerAChoice && this.playerBChoice) {
      const winner = this.determineWinner(this.playerAChoice!, this.playerBChoice!)
      const winnerId = winner === 'tie' ? null : winner === 'A' ? this.playerA : this.playerB
      containerComponents.push({
        type: 10,
        content: `<@${this.playerA}> chose ${this.playerAChoice} ${this.getEmoji(this.playerAChoice)} and <@${this.playerB}> chose ${this.playerBChoice} ${this.getEmoji(this.playerBChoice)}`,
      })
      containerComponents.push({
        type: 10,
        content: winner === 'tie' ? `🤝 It's a tie!` : `<@${winnerId}> wins! 🎉`,
      })

      containerComponents.push({
        type: 1,
        components: [
          {
            type: 2,
            custom_id: 'rps_rematch',
            label: 'Keep Playing?',
            style: 1,
            emoji: { name: '🔁' },
          },
        ],
      })
    }

    if (timeout) {
      if (!this.playerAChoice && !this.playerBChoice) {
        if (this.playerAScore === 0 && this.playerBScore === 0) {
          containerComponents.push({
            type: 10,
            content: `⌛ Nobody made a move... stalemate!`,
          })
        }
      }
      else if (!this.playerAChoice) {
        containerComponents.push({
          type: 10,
          content: `😴 <@${this.playerA}> fell asleep at the keyboard!`,
        })
      }
      else if (!this.playerBChoice) {
        containerComponents.push({
          type: 10,
          content: `😴 <@${this.playerB}> fell asleep at the keyboard!`,
        })
      }
    }

    const rpsCard = {
      type: 17,
      accent_color: 0xFFF200,
      components: containerComponents,
    } satisfies APIMessageTopLevelComponent

    return rpsCard
  }

  determineWinner(a: string, b: string) {
    if (a === b)
      return 'tie'

    const winningCombos: Record<string, string> = {
      Rock: 'Scissors',
      Paper: 'Rock',
      Scissors: 'Paper',
    }

    return winningCombos[a] === b ? 'A' : 'B'
  }

  getEmoji(move: string) {
    switch (move) {
      case 'Rock':
        return '✊'
      case 'Paper':
        return '✋'
      case 'Scissors':
        return '✌️'
    }
  }
}
