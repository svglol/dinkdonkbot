import type { APIApplicationCommandInteraction, APIComponentInContainer, APIMessageComponentInteraction, APIMessageTopLevelComponent, APIModalSubmitInteraction } from 'discord-api-types/v10'
import { DurableObject } from 'cloudflare:workers'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { InteractionResponseType } from 'discord-interactions'
import { buildErrorEmbed, updateInteraction } from '../discord/discord'
import { deferedUpdate, interactionEphemeralLoading } from '../discord/interactionHandler'
import { JsonResponse } from '../util/jsonResponse'

interface PersistedState {
  interaction: APIApplicationCommandInteraction | null
  alarmScheduled: boolean
  phrase: string | null
  customPhrase: boolean
  guesses: { guess: string, userId: string }[]
  wrongGuesses: number
  maxWrongGuesses: number
}

const ALARM_TIME = 60000 * 10// 10 minutes with no interaction

export class HangmanGame extends DurableObject {
  state: DurableObjectState
  env: Env

  // In-memory state (will be synced with persistent state)
  private interaction: APIApplicationCommandInteraction | null = null
  private alarmScheduled: boolean = false
  private phrase: string | null = null
  private customPhrase: boolean = false
  private guesses: { guess: string, userId: string }[] = []
  private wrongGuesses: number = 0
  private maxWrongGuesses: number = 6

  /**
   * Initializes a new HangmanGame durable object.
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
      const persistedState = await this.state.storage.get<PersistedState>('HangmanGame')

      if (persistedState) {
        this.interaction = persistedState.interaction
        this.alarmScheduled = persistedState.alarmScheduled
        this.phrase = persistedState.phrase
        this.customPhrase = persistedState.customPhrase || false
        this.guesses = persistedState.guesses || []
        this.wrongGuesses = persistedState.wrongGuesses || 0
        this.maxWrongGuesses = persistedState.maxWrongGuesses || 6
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
        alarmScheduled: this.alarmScheduled,
        phrase: this.phrase,
        customPhrase: this.customPhrase,
        guesses: this.guesses,
        wrongGuesses: this.wrongGuesses,
        maxWrongGuesses: this.maxWrongGuesses,
      }

      await this.state.storage.put('HangmanGame', stateToSave)
    }
    catch (error) {
      console.error('Failed to save state:', error)
    }
  }

  async alarm(): Promise<void> {
    try {
      this.alarmScheduled = false
      const hangmanCard = this.buildComponents(true)

      if (this.interaction) {
        await updateInteraction(this.interaction, this.env.DISCORD_APPLICATION_ID, {
          flags: 1 << 15,
          components: [hangmanCard],
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
    this.phrase = null
    this.customPhrase = false
    this.guesses = []
    this.wrongGuesses = 0
    this.maxWrongGuesses = 6
    this.alarmScheduled = false
    await this.clearAlarm()
    await this.saveState()
    await this.state.storage.deleteAll()
  }

  async startGame(interaction: APIApplicationCommandInteraction) {
    this.interaction = interaction
    if (!isGuildInteraction(interaction))
      return await updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', this.env)] })

    // Get the word/phrase from the interaction options or fetch a random one
    if (isChatInputApplicationCommandInteraction(interaction) && interaction.data.options) {
      const wordOption = interaction.data.options.find(option => option.name === 'word')
      if (wordOption && 'value' in wordOption && typeof wordOption.value === 'string') {
        this.phrase = wordOption.value.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '')
        this.customPhrase = true
        if (this.phrase.length === 0) {
          this.reset()
          return await updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Phrase cannot be empty', this.env)] })
        }
      }
    }
    else {
      try {
        const phraseResponse = await fetch('https://random-word-api.herokuapp.com/word?number=1')
        const phrase = await phraseResponse.json() as string[]
        if (phrase.length > 0) {
          this.phrase = phrase[0].toUpperCase()
          this.customPhrase = false
        }
        else {
          throw new Error('No phrase returned from API')
        }
      }
      catch (error: any) {
        console.error('Error fetching phrase:', error)
        return await updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Failed to fetch a random phrase', this.env)] })
      }
    }

    // Determine max wrong guesses based on the length of the phrase
    if (this.phrase) {
      const calculatedLives = Math.floor(this.phrase.replace(/[^A-Z]/gi, '').length / 2)
      this.maxWrongGuesses = Math.max(6, Math.min(calculatedLives, 12))
    }

    await this.scheduleAlarm()
    await this.saveState()

    const hangmanCard = this.buildComponents(false)

    return updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, {
      flags: 1 << 15,
      components: [hangmanCard],
    })
  }

  async makeGuessButton(_interaction: APIMessageComponentInteraction) {
    return new JsonResponse({
      type: InteractionResponseType.MODAL,
      data: {
        custom_id: 'hangman_guess_modal',
        title: 'Make a Guess',
        components: [
          {
            type: 1,
            components: [
              {
                custom_id: 'hangman_guess_input',
                type: 4,
                label: 'Guess a letter or the whole word/phrase',
                style: 1,
                min_length: 1,
                max_length: 100,
                placeholder: 'Enter your guess here',
                required: true,
              },
            ],
          },
        ],
      },
    })
  }

  async guessModal(interaction: APIModalSubmitInteraction) {
    return this.state.blockConcurrencyWhile(async () => {
      if (!this.interaction) {
        this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Game not found or already ended', this.env)] }))
        return interactionEphemeralLoading()
      }
      if (this.interaction?.member && interaction.member && this.customPhrase) {
        if (this.interaction.member.user.id === interaction.member.user.id) {
          this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('You cannot guess your own game!', this.env)] }))
          return interactionEphemeralLoading()
        }
      }

      const guessInput = interaction.data.components[0].components.find(c => c.custom_id === 'hangman_guess_input')
      if (!guessInput || guessInput.type !== 4 || typeof guessInput.value !== 'string') {
        this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid guess input.', this.env)] }))
        return interactionEphemeralLoading()
      }

      const guess = guessInput.value.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '')
      if (guess.length === 0) {
        this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Guess cannot be empty, and cannot contain special characters.', this.env)] }))
        return interactionEphemeralLoading()
      }
      if (this.guesses.some(g => g.guess.toUpperCase() === guess)) {
        this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Someone already guessed that phrase or letter!', this.env)] }))
        return interactionEphemeralLoading()
      }
      this.guesses.push({ guess, userId: interaction.member?.user.id ?? '' })

      // calculate if the guess is correct or not
      let isCorrectGuess = false
      if (guess.length === 1) {
        isCorrectGuess = this.phrase?.toUpperCase().includes(guess) || false
      }
      else {
        isCorrectGuess = this.phrase?.toUpperCase() === guess
      }

      if (!isCorrectGuess) {
        this.wrongGuesses += 1
      }

      await this.saveState()
      // Reset the alarm because the game is still ongoing
      const hangmanCard = this.buildComponents()
      if (hangmanCard.components.find(c => c.type === 1)) {
      // If there are still buttons that means the game is still ongoing
        await this.clearAlarm()
        await this.scheduleAlarm()
      }
      else {
      // If there are no buttons, the game is over
        await this.clearAlarm()
        await this.reset()
      }
      this.state.waitUntil(updateInteraction(interaction, this.env.DISCORD_APPLICATION_ID, {
        flags: 1 << 15,
        components: [hangmanCard],
      }))
      return deferedUpdate()
    })
  }

  buildComponents(timeout: boolean = false) {
    const containerComponents: APIComponentInContainer[] = []

    containerComponents.push({
      type: 10,
      content: '# 🎯 Hangman',
    })

    if (!timeout && this.phrase) {
      const guessedLetters = this.guesses
        .filter(g => g.guess.length === 1)
        .map(g => g.guess.toUpperCase())

      const displayPhrase = this.phrase.split('').map((char) => {
        if (char === ' ')
          return '   '
        if (guessedLetters.includes(char.toUpperCase())) {
          return char
        }
        return '\\_'
      }).join('')

      const phraseWon = this.guesses.some(g => g.guess.toUpperCase() === this.phrase?.toUpperCase())
      const lettersWon = displayPhrase === this.phrase
      const gameWon = phraseWon || lettersWon
      if (gameWon) {
        // If the user has guessed the phrase correctly, show a success message
        // Show the revealed phrase
        containerComponents.push({
          type: 10,
          content: `## ${this.phrase}`,
        })

        // Find the winning move
        let winningMove = null
        if (phraseWon) {
        // Someone guessed the whole phrase
          winningMove = this.guesses.find(g => g.guess.toUpperCase() === this.phrase?.toUpperCase())
        }
        else {
        // Game was won by completing all letters - find the last letter that completed it
          const requiredLetters = [...new Set(this.phrase.replace(/[^A-Z]/g, '').split(''))]
          const correctLetterGuesses = this.guesses.filter(g =>
            g.guess.length === 1 && this.phrase?.includes(g.guess.toUpperCase()),
          )

          // Find which letter completed the word
          for (let i = correctLetterGuesses.length - 1; i >= 0; i--) {
            const guessesUpToThis = correctLetterGuesses.slice(0, i + 1)
            const guessedLettersUpToThis = guessesUpToThis.map(g => g.guess.toUpperCase())

            if (requiredLetters.every(letter => guessedLettersUpToThis.includes(letter))) {
              winningMove = correctLetterGuesses[i]
              break
            }
          }
        }

        // Show winning move
        if (winningMove) {
          containerComponents.push({
            type: 10,
            content: `### 🎉 <@${winningMove.userId}> won the game with **${winningMove.guess}**!`,
          })
        }
        else {
          containerComponents.push({
            type: 10,
            content: '### 🎉 Congratulations! You guessed the phrase!',
          })
        }

        // Show all contributors who helped
        const correctLetters = this.guesses.filter(g =>
          g.guess.length === 1 && this.phrase?.includes(g.guess.toUpperCase()),
        )
        const correctPhrases = this.guesses.filter(g =>
          g.guess.length > 1 && g.guess.toUpperCase() === this.phrase?.toUpperCase(),
        )

        const allContributors = [...correctLetters, ...correctPhrases]
        const contributorIds = [
          ...new Set(
            allContributors
              .map(g => g.userId)
              .filter(id => !winningMove || id !== winningMove.userId),
          ),
        ]

        if (contributorIds.length > 1) {
          const contributorList = contributorIds.map(id => `<@${id}>`).join(', ')

          containerComponents.push({
            type: 10,
            content: `**🤝 Team Effort!** Thanks to: ${contributorList}`,
          })
        }
      }
      else if (this.wrongGuesses >= this.maxWrongGuesses) {
        // If the user has run out of lives, show a failure message
        containerComponents.push({
          type: 10,
          content: `## ${this.phrase}`,
        })
        containerComponents.push({
          type: 10,
          content: '### ❌ Game Over! You ran out of lives!',
        })
      }
      else {
        // If the user has not guessed the phrase correctly, show the current state
        containerComponents.push({
          type: 10,
          content: `## ${displayPhrase}`,
        })

        // show the guesses made so far
        const letterGuesses = this.guesses.filter(g => g.guess.length === 1)
        const phraseGuesses = this.guesses.filter(g => g.guess.length > 1)

        // Handle letter guesses
        const correctLetters = letterGuesses.filter(g => this.phrase?.includes(g.guess.toUpperCase()))
        const wrongLetters = letterGuesses.filter(g => !this.phrase?.includes(g.guess.toUpperCase()))

        // Handle phrase guesses
        const correctPhrases = phraseGuesses.filter(g => g.guess.toUpperCase() === this.phrase?.toUpperCase())
        const wrongPhrases = phraseGuesses.filter(g => g.guess.toUpperCase() !== this.phrase?.toUpperCase())

        const allCorrectGuesses = [
          ...correctLetters.map(g => `**${g.guess.toUpperCase()}** - <@${g.userId}>`),
          ...correctPhrases.map(g => `**${g.guess.toUpperCase()}** - <@${g.userId}>`),
        ]

        if (allCorrectGuesses.length > 0) {
          containerComponents.push({
            type: 10,
            content: `**✅ Correct Guesses**\n${allCorrectGuesses.join(', ')}`,
          })
        }
        // Display wrong guesses (both letters and phrases)
        const allWrongGuesses = [
          ...wrongLetters.map(g => `**${g.guess.toUpperCase()}** - <@${g.userId}>`),
          ...wrongPhrases.map(g => `**${g.guess.toUpperCase()}** - <@${g.userId}>`),
        ]

        if (allWrongGuesses.length > 0) {
          containerComponents.push({
            type: 10,
            content: `**❌ Wrong Guesses**\n${allWrongGuesses.join(', ')}`,
          })
        }

        const livesLeft = this.maxWrongGuesses - this.wrongGuesses

        containerComponents.push({
          type: 10,
          content: `**Lives Left**: ${'❤️'.repeat(livesLeft) + '💀'.repeat(this.maxWrongGuesses - livesLeft)}`,
        })

        containerComponents.push({
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              custom_id: 'hangman_make_guess',
              label: 'Make a guess',
            },
          ],
        })
      }
    }
    else {
      // If the game has timed out, show a timeout message
      containerComponents.push({
        type: 10,
        content: `## ${this.phrase}`,
      })
      containerComponents.push({
        type: 10,
        content: '### ⏰ Game Over! The game has timed out!',
      })
    }

    const hangmanCard = {
      type: 17,
      accent_color: 0xFFF200,
      components: containerComponents,
    } satisfies APIMessageTopLevelComponent

    return hangmanCard
  }
}
