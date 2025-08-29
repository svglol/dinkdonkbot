import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { PermissionFlagsBits } from 'discord-api-types/v10'
import { and, eq, like } from 'drizzle-orm'
import { tables, useDB } from '../../database/db'
import { getChannelId, getStreamerDetails, searchStreamers } from '../../twitch/twitch'
import { CLIPPERS_EMOTE, TWITCH_EMOTE } from '../../util/discordEmotes'
import { buildErrorEmbed, buildSuccessEmbed, calculateChannelPermissions, findBotCommandMarkdown, updateInteraction } from '../discord'
import { autoCompleteResponse, interactionEphemeralLoading } from '../interactionHandler'

const TWITCH_CLIPS_COMMAND = {
  name: 'clips',
  description: 'Manage Twitch clip subscriptions for streamers to be posted hourly',
  default_member_permissions: PermissionFlagsBits.Administrator.toString(),
  dm_permission: false,
  options: [{
    type: 1,
    name: 'add',
    description: 'Subscribe to Twitch clips from a streamer',
    dm_permission: false,
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the Twitch streamer to subscribe to',
      required: true,
      autocomplete: true,
    }, {
      type: 7,
      name: 'discord-channel',
      description: 'The Discord channel where clips will be posted',
      required: true,
      channel_types: [0],
    }],
  }, {
    type: 1,
    name: 'remove',
    description: 'Unsubscribe from Twitch clips from a streamer',
    dm_permission: false,
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the Twitch streamer to unsubscribe from',
      required: true,
      autocomplete: true,
    }],
  }, {
    type: 1,
    name: 'edit',
    description: 'Update the settings for a Twitch clip subscription',
    dm_permission: false,
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the Twitch streamer to update',
      required: true,
      autocomplete: true,
    }, {
      type: 7,
      name: 'discord-channel',
      description: 'The Discord channel where clips will be posted',
      channel_types: [0],
      required: true,
    }],
  }, {
    type: 1,
    name: 'list',
    description: 'View your subscribed Twitch clip channels',
    dm_permission: false,
  }, {
    type: 1,
    name: 'help',
    description: 'Show help for the Twitch clips command',
    dm_permission: false,
  }],
}

export async function getClipsHelpMessage(env: Env) {
  return `Subscribe to automatic Twitch clip notifications from your favorite streamers. Get the best clips posted hourly to your Discord channels.
- ${await findBotCommandMarkdown(env, 'clips', 'add')} <streamer> <discord-channel> - Add a Twitch streamer to receive clip notifications when they go live or offline.  
- ${await findBotCommandMarkdown(env, 'clips', 'remove')} <streamer> - Remove a Twitch streamer from receiving clip notifications.
- ${await findBotCommandMarkdown(env, 'clips', 'edit')} <streamer> <discord-channel> - Edit the notification channel for a Twitch streamer.
- ${await findBotCommandMarkdown(env, 'clips', 'list')} - List all the Twitch streamers you are subscribed to for clip notifications.  
- ${await findBotCommandMarkdown(env, 'clips', 'help')} - Get this help message for clip notifications commands.

**Command variables**
> \`<streamer>\` – The name of the streamer to add  
> \`<discord-channel>\` – The Discord channel to post to when the streamer goes live`
}

function handler(interaction: APIApplicationCommandInteraction, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(handleTwitchClipsCommand(interaction, env))
  return interactionEphemeralLoading()
}

/**
 * Handles the /clips command.
 * @param interaction The interaction object from Discord
 * @param env The environment object
 * @returns A promise that resolves to nothing
 *
 * If the user provides a subcommand, the bot will handle it here.
 *
 * The subcommands are:
 * add: Adds a Twitch streamer to receive clip notifications when they go live or offline.
 * remove: Removes a Twitch streamer from receiving clip notifications.
 * edit: Edits the notification channel for a Twitch streamer.
 * list: Lists all the Twitch streamers you are subscribed to for clip notifications.
 * help: Shows this help message for clip notifications commands.
 */
async function handleTwitchClipsCommand(interaction: APIApplicationCommandInteraction, env: Env) {
  if (!interaction.data || !isChatInputApplicationCommandInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!interaction.data.options)
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const server = interaction.guild_id
      const add = interaction.data.options.find(option => option.name === 'add')
      if (!add || !('options' in add) || !add.options)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

      const streamerOption = add.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      const channelOption = add.options.find(option => option.name === 'discord-channel')
      const channel = channelOption && 'value' in channelOption ? channelOption.value as string : undefined

      if (!streamer || !channel)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

      // check if we have permission to post in this discord channel
      const permissions = await calculateChannelPermissions(interaction.guild_id!, channel, env.DISCORD_APPLICATION_ID, env.DISCORD_TOKEN, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.MentionEveryone])
      const missingPermissions = Object.entries(permissions.checks)
        .filter(([_, hasPermission]) => !hasPermission)
        .map(([permissionName]) => permissionName)

      if (missingPermissions.length > 0) {
        const permissionError = `Dinkdonk Bot does not have the required permissions use <#${channel}>.\nMissing permissions: ${missingPermissions.join(', ')}`
        console.error(permissionError)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(permissionError, env)] })
      }

      // check if already subscribed to this channel
      const subscriptions = await useDB(env).query.clips.findMany({
        where: (clips, { eq, and, like }) => and(eq(clips.guildId, server), like(clips.streamer, streamer)),
      })
      if (subscriptions.length > 0)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

      // check if twitch channel exists
      const channelId = await getChannelId(streamer, env)
      if (!channelId)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(`Twitch channel with name:\`${streamer}\` could not be found`, env)] })

      const streamerDetails = await getStreamerDetails(streamer, env)

      // add to database
      const subscription = await useDB(env).insert(tables.clips).values({
        streamer: streamerDetails ? streamerDetails.display_name : streamer,
        broadcasterId: channelId,
        guildId: server,
        channelId: channel,
      }).returning().get()

      if (!subscription)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Failed to add subscription', env)] })

      let details = `Streamer: \`${subscription.streamer}\`\n`
      details += `Channel: <#${subscription.channelId}>\n`

      return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(details, env, {
        title: `${TWITCH_EMOTE.formatted} Subscribed for Clip Notifications for \`${streamerDetails ? streamerDetails.display_name : streamer}\``,
        ...(streamerDetails?.profile_image_url && {
          thumbnail: { url: streamerDetails.profile_image_url },
        }),
      })] })
    }
    case 'remove': {
      const remove = interaction.data.options.find(option => option.name === 'remove')
      if (!remove || !('options' in remove) || !remove.options)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const streamerOption = remove.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

      const stream = await useDB(env).query.clips.findFirst({
        where: (clips, { and, eq, like }) => and(like(clips.streamer, streamer), eq(clips.guildId, interaction.guild_id)),
      })
      if (!stream)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You are not subscribed to this streamer', env)] })

      await useDB(env).delete(tables.clips).where(and(like(tables.clips.streamer, streamer), eq(tables.clips.guildId, interaction.guild_id)))

      return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(`Unsubscribed to \`${streamer}\` for clip notifications`, env)] })
    }
    case 'edit': {
      const server = interaction.guild_id
      const edit = interaction.data.options.find(option => option.name === 'edit')
      if (!edit || !('options' in edit) || !edit.options)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const streamerOption = edit.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const dbClip = await useDB(env).query.clips.findFirst({
        where: (clips, { and, eq, like }) => and(like(clips.streamer, streamer), eq(clips.guildId, interaction.guild_id)),
      })
      if (!dbClip)
        return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed('You are not subscribed to this streamer', env)] })

      const channel = edit.options.find(option => option.name === 'discord-channel')
      if (channel) {
        const channelValue = String('value' in channel ? channel.value : '')
        const permissions = await calculateChannelPermissions(interaction.guild_id!, channelValue, env.DISCORD_APPLICATION_ID, env.DISCORD_TOKEN, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.MentionEveryone])
        const missingPermissions = Object.entries(permissions.checks)
          .filter(([_, hasPermission]) => !hasPermission)
          .map(([permissionName]) => permissionName)

        if (missingPermissions.length > 0) {
          const permissionError = `Dinkdonk Bot does not have the required permissions use <#${channelValue}>.\nMissing permissions: ${missingPermissions.join(', ')}`
          console.error(permissionError)
          return await updateInteraction(interaction, env, { embeds: [buildErrorEmbed(permissionError, env)] })
        }

        await useDB(env).update(tables.clips).set({ channelId: channelValue }).where(and(like(tables.clips.streamer, streamer), eq(tables.clips.guildId, server)))
      }

      return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(`Edited \`${streamer}\` for clip notifications`, env)] })
    }
    case 'list': {
      const clips = await useDB(env).query.clips.findMany({
        where: (clips, { eq }) => eq(clips.guildId, interaction.guild_id),
      })
      let clipsList = 'Not subscribed to recive clip notifications for any streams'
      if (clips.length > 0)
        clipsList = clips.map(stream => `**${stream.streamer}** - <#${stream.channelId}>`).join('\n')

      return await updateInteraction(interaction, env, { embeds: [buildSuccessEmbed(clipsList, env, { title: `${TWITCH_EMOTE.formatted} Clip Notifications` })] })
    }
    case 'help': {
      const helpCard = {
        type: 17,
        accent_color: 0xFFF200,
        components: [
          {
            type: 9,
            components: [
              {
                type: 10,
                content: `# ${CLIPPERS_EMOTE.formatted} Available Commands for Clip Notifications`,
              },
              {
                type: 10,
                content: await getClipsHelpMessage(env),
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
      return await updateInteraction(interaction, env, { components: [helpCard], flags: 1 << 15 })
    }
  }
}

async function autoCompleteHandler(interaction: APIApplicationCommandAutocompleteInteraction, env: Env, _ctx: ExecutionContext) {
  if (!isGuildInteraction(interaction))
    return autoCompleteResponse([])
  const guildId = interaction.guild_id
  if (interaction.data.options.find(option => option.name === 'remove') || interaction.data.options.find(option => option.name === 'edit')) {
  // auto correct for remove and edit sub commands
    const subCommand = interaction.data.options.find(option => option.name === 'remove') || interaction.data.options.find(option => option.name === 'edit')
    if (!subCommand || !('options' in subCommand) || !subCommand.options)
      return autoCompleteResponse([])
    const streamerOption = subCommand.options.find(option => option.name === 'streamer')
    if (!streamerOption || !('value' in streamerOption) || !('focused' in streamerOption))
      return autoCompleteResponse([])

    if (streamerOption.focused) {
      // we can auto complete the streamer field
      const input = streamerOption.value.toLowerCase()
      const cacheKey = `autocomplete:${guildId}:clips:${subCommand.name}:${input}`

      // Try KV cache
      const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
      if (cached)
        return autoCompleteResponse(cached)

      const streamers = await useDB(env).query.clips.findMany({
        where: (clips, { and, eq, like }) => and(eq(clips.guildId, guildId), like(clips.streamer, `%${streamerOption.value}%`)),
      })
      const choices = streamers
        .map(stream => ({ name: stream.streamer, value: stream.streamer }))
        .sort((a, b) => {
          if (a.name.toLowerCase() === input.toLowerCase() && b.name.toLowerCase() !== input.toLowerCase()) {
            return -1
          }
          if (b.name.toLowerCase() === input.toLowerCase() && a.name.toLowerCase() !== input.toLowerCase()) {
            return 1
          }
          return a.name.localeCompare(b.name)
        })
      await env.KV.put(cacheKey, JSON.stringify(choices), { expirationTtl: 60 })
      return autoCompleteResponse(choices)
    }
  }
  if (interaction.data.options.find(option => option.name === 'add')) {
    // auto complete for add sub command (this one searches for streamers on twitch)
    const subCommand = interaction.data.options.find(option => option.name === 'add')
    if (!subCommand || !('options' in subCommand) || !subCommand.options)
      return autoCompleteResponse([])
    const streamerOption = subCommand.options.find(option => option.name === 'streamer')
    if (!streamerOption || !('value' in streamerOption) || !('focused' in streamerOption))
      return autoCompleteResponse([])

    if (streamerOption.focused) {
      // we can auto complete the streamer field
      const input = streamerOption.value.toLowerCase()
      const cacheKey = `autocomplete:${guildId}:clips:${subCommand.name}:${input}`

      // Try KV cache
      const cached = await env.KV.get(cacheKey, { type: 'json' }) as { name: string, value: string }[] | null
      if (cached)
        return autoCompleteResponse(cached)

      const streamers = await searchStreamers(input, env)

      const choices = streamers
        .map(stream => ({ name: stream.display_name, value: stream.display_name }))
        .sort((a, b) => {
          if (a.name.toLowerCase() === input.toLowerCase() && b.name.toLowerCase() !== input.toLowerCase()) {
            return -1
          }
          if (b.name.toLowerCase() === input.toLowerCase() && a.name.toLowerCase() !== input.toLowerCase()) {
            return 1
          }
          return a.name.localeCompare(b.name)
        })
      await env.KV.put(cacheKey, JSON.stringify(choices), { expirationTtl: 60 })

      return autoCompleteResponse(choices)
    }
  }
  return autoCompleteResponse([])
}

export default {
  command: TWITCH_CLIPS_COMMAND,
  handler,
  autoCompleteHandler,
} satisfies DiscordAPIApplicationCommand
