import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import type { MultiStream } from '../../database/db'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { eq, tables, useDB } from '../../database/db'
import { KICK_EMOTE, TWITCH_EMOTE } from '../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, findBotCommandMarkdown, updateInteraction } from '../discord'
import { autoCompleteResponse, interactionEphemeralLoading } from '../interactionHandler'

const MULTISTREAM_COMMAND = {
  name: 'multistream',
  description: 'Multistream notifications - Merge Twitch/Kick notifications into one message',
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
  options: [
    {
      type: 1,
      name: 'link',
      description: 'Setup a multistream connection between a Twitch & Kick Channel',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'twitch-streamer',
        description: 'The name of the Twitch streamer to add (you must already have a Twitch Alert setup)',
        required: true,
        autocomplete: true,
      }, {
        type: 3,
        name: 'kick-streamer',
        description: 'The name of the Kick streamer to add (you must already have a Kick Alert setup)',
        required: true,
        autocomplete: true,
      }, {
        type: 3,
        name: 'priority',
        description: 'Which platforms data should be used first in embeds (Twitch or Kick)',
        choices: [
          { name: 'Twitch', value: 'twitch' },
          { name: 'Kick', value: 'kick' },
        ],
      }],
    },
    {
      type: 1,
      name: 'unlink',
      description: 'Remove a multistream connection between a Twitch & Kick Channel',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'twitch-streamer',
        description: 'The name of the Twitch streamer to remove',
        required: false,
        autocomplete: true,
      }, {
        type: 3,
        name: 'kick-streamer',
        description: 'The name of the Kick streamer to remove',
        required: false,
        autocomplete: true,
      }],
    },
    {
      type: 1,
      name: 'list',
      description: 'List your currently set up multistreams',
      dm_permission: false,
    },
    {
      type: 1,
      name: 'help',
      description: 'Show help for the multistream command',
      dm_permission: false,
    },
    {
      type: 1,
      name: 'edit',
      description: 'Edit a multistream setup settings',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'twitch-streamer',
        description: 'The name of the Twitch streamer to edit',
        required: false,
        autocomplete: true,
      }, {
        type: 3,
        name: 'kick-streamer',
        description: 'The name of the Kick streamer to edit',
        required: false,
        autocomplete: true,
      }, {
        type: 3,
        name: 'priority',
        description: 'Which platforms data should be used first in embeds (Twitch or Kick)',
        choices: [
          { name: 'Twitch', value: 'twitch' },
          { name: 'Kick', value: 'kick' },
        ],
      }],
    },
  ],
}

export async function getMultistreamHelpMessage(env: Env) {
  return `
Do you or the streamer you follow broadcast to both Twitch and Kick at the same time? You can link the streams so the bot combines notifications into a single message whenever possible, cutting down on spam.

To use this feature:
- Both Twitch and Kick alerts need to be set up.
- Make sure both are configured to post to the same Discord channel.
- When one stream goes live, the bot will wait up to 15 seconds for the other to start before sending a notification.
- You can set a priority to decide which platform’s data the message should use first.

**Multistream commands**
- ${await findBotCommandMarkdown(env, 'multistream', 'link')} - <twitch-streamer> <kick-streamer> <priority> - Setup a multistream connection between a Twitch & Kick Channel
- ${await findBotCommandMarkdown(env, 'multistream', 'unlink')} - <twitch-streamer> <kick-streamer> - Remove a multistream connection between a Twitch & Kick Channel
- ${await findBotCommandMarkdown(env, 'multistream', 'edit')} <twitch-streamer> <kick-streamer> <priority> - Edit a multistream connection
- ${await findBotCommandMarkdown(env, 'multistream', 'list')} - List your currently set up multistreams
- ${await findBotCommandMarkdown(env, 'multistream', 'help')} - Show help for the multistream command

**Command variables**
> \`<twitch-streamer>\` - The name of the Twitch streamer to add (you must already have a Twitch Alert setup)
> \`<kick-streamer>\` - The name of the Kick streamer to add (you must already have a Kick Alert setup)
> \`<priority>\` - Which platforms data should be used first in embeds (Twitch or Kick)
`
}

async function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleCommands(interaction, env))
  return interactionEphemeralLoading()
}

async function handleCommands(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })
  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const option = interaction.data.options[0].name
  switch (option) {
    case 'link': {
      const link = interaction.data.options.find(option => option.name === 'link')
      if (!link || !('options' in link) || !link.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

      const twitchStreamerOption = link.options.find(option => option.name === 'twitch-streamer')
      const twitchStreamer = twitchStreamerOption && 'value' in twitchStreamerOption ? twitchStreamerOption.value as string : undefined

      const kickStreamerOption = link.options.find(option => option.name === 'kick-streamer')
      const kickStreamer = kickStreamerOption && 'value' in kickStreamerOption ? kickStreamerOption.value as string : undefined

      const priorityOption = link.options.find(option => option.name === 'priority')
      const priority = priorityOption && 'value' in priorityOption ? (priorityOption.value as 'twitch' | 'kick') : 'twitch'

      const streams = await useDB(env).query.streams.findMany({
        where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
        with: {
          multiStream: true,
        },
      })

      const kickStreams = await useDB(env).query.kickStreams.findMany({
        where: (kickStreams, { eq }) => eq(kickStreams.guildId, interaction.guild_id),
        with: {
          multiStream: true,
        },
      })

      const twitchStream = streams.find(stream => stream.name.toLowerCase() === twitchStreamer?.toLowerCase())
      const kickStream = kickStreams.find(stream => stream.name.toLowerCase() === kickStreamer?.toLowerCase())

      if (twitchStream && kickStream) {
        if (twitchStream.multiStream)
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`The Twitch streamer is already linked to a multistream, if you want to relink it use the ${await findBotCommandMarkdown(env, 'multistream', 'unlink')} command`, env)] })

        if (kickStream.multiStream)
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`The Kick streamer is already linked to a multistream, if you want to relink it use the ${await findBotCommandMarkdown(env, 'multistream', 'unlink')} command`, env)] })

        if (twitchStream.channelId !== kickStream.channelId)
          return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('The Twitch and Kick streamers must be setup to post in the same channel', env)] })

        await useDB(env).insert(tables.multiStream).values({
          streamId: twitchStream.id,
          kickStreamId: kickStream.id,
          priority,
        })

        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
          embeds: [
            buildSuccessEmbed(`Priority: ${priority}`, env, {
              title: `Successfully linked ${TWITCH_EMOTE.formatted}\`${twitchStream.name}\` + ${KICK_EMOTE.formatted}\`${kickStream.name}\``,
            }),
          ],
        })
      }
      else {
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Could not find the appropriate subscriptions to link', env)] })
      }
    }
    case 'unlink':{
      const unlink = interaction.data.options.find(option => option.name === 'unlink')
      if (!unlink || !('options' in unlink) || !unlink.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

      const twitchStreamerOption = unlink.options.find(option => option.name === 'twitch-streamer')
      const twitchStreamer = twitchStreamerOption && 'value' in twitchStreamerOption ? twitchStreamerOption.value as string : undefined

      const kickStreamerOption = unlink.options.find(option => option.name === 'kick-streamer')
      const kickStreamer = kickStreamerOption && 'value' in kickStreamerOption ? kickStreamerOption.value as string : undefined

      if (!twitchStreamer && !kickStreamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('You must specify a Twitch or Kick streamer to unlink', env)] })

      const streams = await useDB(env).query.streams.findMany({
        where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
        with: {
          multiStream: { with: { kickStream: true, stream: true } },
        },
      })

      const multiStreams = streams.filter(stream => stream.multiStream)

      const twitchStream = multiStreams.find(stream => stream.name.toLowerCase() === twitchStreamer?.toLowerCase())
      const kickStream = multiStreams.find(stream => stream.name.toLowerCase() === kickStreamer?.toLowerCase())

      if (twitchStream || kickStream) {
        const multiStream = twitchStream?.multiStream || kickStream?.multiStream

        if (multiStream)
          await useDB(env).delete(tables.multiStream).where(eq(tables.multiStream.id, multiStream.id))

        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
          embeds: [
            buildSuccessEmbed(` `, env, {
              title: `Successfully removed ${TWITCH_EMOTE.formatted}\`${multiStream?.stream?.name}\` + ${KICK_EMOTE.formatted}\`${multiStream?.kickStream?.name}\` multistream link`,
            }),
          ],
        })
      }
      else {
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Could not find the appropriate subscriptions to remove', env)] })
      }
    }
    case 'list':{
      const streams = await useDB(env).query.streams.findMany({
        where: (streams, { eq }) => eq(streams.guildId, interaction.guild_id),
        with: {
          multiStream: {
            with: {
              stream: true,
              kickStream: true,
            },
          },
        },
      })

      const multiStreams = streams.filter(stream => stream.multiStream).flatMap(stream => stream.multiStream)

      if (multiStreams.length > 0) {
        const list = multiStreams.map(multistream => `${TWITCH_EMOTE.formatted}\`${multistream.stream.name}\` ${KICK_EMOTE.formatted}\`${multistream.kickStream.name}\` ${'Priority: '}${multistream.priority === 'twitch' ? TWITCH_EMOTE.formatted : KICK_EMOTE.formatted}`).join('\n')
        return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(list, env, { title: 'Multistream Links', color: 0xFFF200 })] })
      }
      else {
        return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('No multistream links found', env)] })
      }
    }
    case 'edit': {
      const edit = interaction.data.options.find(option => option.name === 'edit')
      if (!edit || !('options' in edit) || !edit.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

      const twitchStreamerOption = edit.options.find(option => option.name === 'twitch-streamer')
      const twitchStreamer = twitchStreamerOption && 'value' in twitchStreamerOption ? twitchStreamerOption.value as string : undefined

      const kickStreamerOption = edit.options.find(option => option.name === 'kick-streamer')
      const kickStreamer = kickStreamerOption && 'value' in kickStreamerOption ? kickStreamerOption.value as string : undefined

      const priorityOption = edit.options.find(option => option.name === 'priority')
      const priority = priorityOption && 'value' in priorityOption ? (priorityOption.value as 'twitch' | 'kick') : undefined

      if (!twitchStreamer && !kickStreamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('You must specify either a Twitch or Kick streamer to edit', env)] })

      if (!priority)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('You must specify a priority to update', env)] })

      let multiStreamToEdit: MultiStream | null = null
      let streamerName = ''

      if (twitchStreamer) {
        const streams = await useDB(env).query.streams.findMany({
          where: (streams, { eq, and }) => and(eq(streams.guildId, interaction.guild_id), eq(streams.name, twitchStreamer)),
          with: {
            multiStream: {
              with: {
                kickStream: true,
              },
            },
          },
        })

        const streamWithMultiStream = streams.find(stream => stream.multiStream)
        if (streamWithMultiStream?.multiStream) {
          multiStreamToEdit = streamWithMultiStream.multiStream
          streamerName = `${TWITCH_EMOTE.formatted}:${twitchStreamer} + ${KICK_EMOTE.formatted}:${streamWithMultiStream.multiStream.kickStream.name}`
        }
      }
      else if (kickStreamer) {
        const kickStreams = await useDB(env).query.kickStreams.findMany({
          where: (kickStreams, { eq, and }) => and(eq(kickStreams.guildId, interaction.guild_id), eq(kickStreams.name, kickStreamer)),
          with: {
            multiStream: {
              with: {
                stream: true,
              },
            },
          },
        })

        const kickStreamWithMultiStream = kickStreams.find(stream => stream.multiStream)
        if (kickStreamWithMultiStream?.multiStream) {
          multiStreamToEdit = kickStreamWithMultiStream.multiStream
          streamerName = `${TWITCH_EMOTE.formatted}:${kickStreamWithMultiStream.multiStream.stream.name} + ${KICK_EMOTE.formatted}:${kickStreamer}`
        }
      }

      if (!multiStreamToEdit) {
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
          embeds: [buildErrorEmbed('Could not find a multistream setup for the specified streamer', env)],
        })
      }

      // Update the multistream priority
      await useDB(env).update(tables.multiStream).set({ priority }).where(eq(tables.multiStream.id, multiStreamToEdit.id))

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, {
        embeds: [
          buildSuccessEmbed(`Priority updated to: ${priority}`, env, {
            title: `Successfully updated \`${streamerName}\` multistream settings`,
          }),
        ],
      })
    }
    case 'help':{
      const helpCard = {
        type: 17,
        accent_color: 0xFFF200,
        components: [
          {
            type: 9,
            components: [
              {
                type: 10,
                content: '# 📺 Multistream Help',
              },
              {
                type: 10,
                content: await getMultistreamHelpMessage(env),
              },
            ],
            accessory: {
              type: 11,
              media: {
                url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
              },
            },
          },
        ],
      } satisfies APIMessageTopLevelComponent
      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { components: [helpCard], flags: 1 << 15 })
    }
  }
  return updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Not yet implemented', env)] })
}

async function autoCompleteHandler(interaction: APIApplicationCommandAutocompleteInteraction, env: Env, _ctx: ExecutionContext) {
  if (!isGuildInteraction(interaction))
    return autoCompleteResponse([])
  const guildId = interaction.guild_id

  if (interaction.data.options.find(option => option.name === 'unlink') || interaction.data.options.find(option => option.name === 'edit')) {
    const subCommand = interaction.data.options.find(option => option.name === 'unlink') || interaction.data.options.find(option => option.name === 'edit')
    if (!subCommand || !('options' in subCommand) || !subCommand.options)
      return autoCompleteResponse([])

    // Find which field is currently being focused/typed in
    const focusedOption = subCommand.options.find(option => 'focused' in option && option.focused)
    if (!focusedOption)
      return autoCompleteResponse([])

    const focusedValue = 'value' in focusedOption ? (focusedOption.value as string) : ''
    const focusedField = focusedOption.name

    // Create cache key based on focused field and value
    const cacheKey = `autocomplete:${guildId}:multistream:${subCommand.name}:${focusedField}:${focusedValue}`
    const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
    if (cached)
      return autoCompleteResponse(cached)

    let choices: { name: string, value: string }[] = []

    if (focusedField === 'twitch-streamer') {
      const twitchStreams = await useDB(env).query.streams.findMany({
        where: (streams, { and, eq, like }) => and(
          eq(streams.guildId, guildId),
          like(streams.name, `%${focusedValue}%`),
        ),
        with: {
          multiStream: true,
        },
      })

      // Only show streams that ARE linked to multistreams
      const linkedStreams = twitchStreams.filter(stream => stream.multiStream)
      choices = linkedStreams.map(stream => ({ name: stream.name, value: stream.name }))
    }
    else if (focusedField === 'kick-streamer') {
      const kickStreams = await useDB(env).query.kickStreams.findMany({
        where: (stream, { and, eq, like }) => and(
          eq(stream.guildId, guildId),
          like(stream.name, `%${focusedValue}%`),
        ),
        with: {
          multiStream: true,
        },
      })

      // Only show streams that ARE linked to multistreams
      const linkedKickStreams = kickStreams.filter(stream => stream.multiStream)
      choices = linkedKickStreams.map(stream => ({ name: stream.name, value: stream.name }))
    }

    // Limit to max 25 choices (Discord's limit)
    choices = choices.slice(0, 25)

    // Cache the results for 60 seconds
    await env.KV.put(cacheKey, JSON.stringify(choices), { expirationTtl: 60 })
    return autoCompleteResponse(choices)
  }
  else if (interaction.data.options.find(option => option.name === 'link')) {
    const subCommand = interaction.data.options.find(option => option.name === 'link')
    if (!subCommand || !('options' in subCommand) || !subCommand.options)
      return autoCompleteResponse([])

    // Find which field is currently being focused/typed in
    const focusedOption = subCommand.options.find(option => 'focused' in option && option.focused)
    if (!focusedOption)
      return autoCompleteResponse([])

    const focusedValue = 'value' in focusedOption ? (focusedOption.value as string) : ''
    const focusedField = focusedOption.name

    // Create cache key based on focused field and value
    const cacheKey = `autocomplete:${guildId}:multistream:link:${focusedField}:${focusedValue}`
    const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
    if (cached)
      return autoCompleteResponse(cached)

    let choices: { name: string, value: string }[] = []

    if (focusedField === 'twitch-streamer') {
    // Get all Twitch streams that aren't already linked to a multistream
      const streams = await useDB(env).query.streams.findMany({
        where: (stream, { and, eq, like }) => and(
          eq(stream.guildId, guildId),
          like(stream.name, `%${focusedValue}%`),
        ),
        with: {
          multiStream: true,
        },
      })

      // Filter out streams that are already linked
      const availableStreams = streams.filter(stream => !stream.multiStream)
      choices = availableStreams.map(stream => ({ name: stream.name, value: stream.name }))
    }
    else if (focusedField === 'kick-streamer') {
    // Get all Kick streams that aren't already linked to a multistream
      const kickStreams = await useDB(env).query.kickStreams.findMany({
        where: (stream, { and, eq, like }) => and(
          eq(stream.guildId, guildId),
          like(stream.name, `%${focusedValue}%`),
        ),
        with: {
          multiStream: true,
        },
      })

      // Filter out streams that are already linked
      const availableKickStreams = kickStreams.filter(stream => !stream.multiStream)
      choices = availableKickStreams.map(stream => ({ name: stream.name, value: stream.name }))
    }

    await env.KV.put(cacheKey, JSON.stringify(choices), { expirationTtl: 60 })
    return autoCompleteResponse(choices)
  }
  return autoCompleteResponse([])
}

export default {
  command: MULTISTREAM_COMMAND,
  handler,
  autoCompleteHandler,
} satisfies DiscordAPIApplicationCommand
