import type { APIApplicationCommandInteraction, APIMessageTopLevelComponent } from 'discord-api-types/v10'
import { isChatInputApplicationCommandInteraction, isGuildInteraction } from 'discord-api-types/utils'
import { and, eq, like } from 'drizzle-orm'
import { tables, useDB } from '../../database/db'
import { getChannelId, getStreamerDetails } from '../../twitch/twitch'
import { buildErrorEmbed, buildSuccessEmbed, checkChannelPermission, updateInteraction } from '../discord'
import { interactionEphemeralLoading } from '../interactionHandler'
import { COMMAND_PERMISSIONS } from './permissions'

const TWITCH_CLIPS_COMMAND = {
  name: 'clips',
  description: 'Manage Twitch clip subscriptions for streamers to be posted hourly',
  default_member_permissions: COMMAND_PERMISSIONS.ADMINISTRATOR,
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

export const CLIPS_HELP_MESSAGE = `</clips add:1348090120418361426> <streamer> <discord-channel>  
Add a Twitch streamer to receive clip notifications when they go live or offline.  
\`<streamer>\` – The name of the streamer to add  
\`<discord-channel>\` – The Discord channel to post to when the streamer goes live  

</clips remove:1348090120418361426> <streamer>  
Remove a Twitch streamer from receiving clip notifications.  
\`<streamer>\` – The name of the streamer to remove  

</clips edit:1348090120418361426><streamer> <discord-channel>  
Edit the notification channel for a Twitch streamer.  
\`<streamer>\` – The name of the streamer to edit  
\`<discord-channel>\` – The new Discord channel to post notifications for the streamer  

</clips list:1348090120418361426>
List all the Twitch streamers you are subscribed to for clip notifications.  

</clips help:1348090120418361426>
Get this help message for clip notifications commands.
`

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
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!interaction.data.options)
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid interaction', env)] })

  if (!isGuildInteraction(interaction))
    return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('This command can only be used in a server', env)] })

  const option = interaction.data.options[0].name
  switch (option) {
    case 'add': {
      const server = interaction.guild_id
      const add = interaction.data.options.find(option => option.name === 'add')
      if (!add || !('options' in add) || !add.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

      const streamerOption = add.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      const channelOption = add.options.find(option => option.name === 'discord-channel')
      const channel = channelOption && 'value' in channelOption ? channelOption.value as string : undefined

      if (!streamer || !channel)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

      // check if we have permission to post in this discord channel
      const hasPermission = await checkChannelPermission(channel, env.DISCORD_TOKEN)
      if (!hasPermission)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`Dinkdonk Bot does not have the required permissions to post in <#${channel}>`, env)] })

      // check if already subscribed to this channel
      const subscriptions = await useDB(env).query.clips.findMany({
        where: (clips, { eq, and, like }) => and(eq(clips.guildId, server), like(clips.streamer, streamer)),
      })
      if (subscriptions.length > 0)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`You are not subscribed to notifications for this streamer: \`${streamer}\``, env)] })

      // check if twitch channel exists
      const channelId = await getChannelId(streamer, env)
      if (!channelId)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed(`Twitch channel with name:\`${streamer}\` could not be found`, env)] })

      const streamerDetails = await getStreamerDetails(streamer, env)

      // add to database
      const subscription = await useDB(env).insert(tables.clips).values({
        streamer: streamerDetails ? streamerDetails.display_name : streamer,
        broadcasterId: channelId,
        guildId: server,
        channelId: channel,
      }).returning().get()

      if (!subscription)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Failed to add subscription', env)] })

      let details = `Streamer: \`${subscription.streamer}\`\n`
      details += `Channel: <#${subscription.channelId}>\n`

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(details, env, {
        title: `<:twitch:1404661243373031585> Subscribed for Clip Notifications for \`${streamerDetails ? streamerDetails.display_name : streamer}\``,
        ...(streamerDetails?.profile_image_url && {
          thumbnail: { url: streamerDetails.profile_image_url },
        }),
      })] })
    }
    case 'remove': {
      const remove = interaction.data.options.find(option => option.name === 'remove')
      if (!remove || !('options' in remove) || !remove.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const streamerOption = remove.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })

      const stream = await useDB(env).query.clips.findFirst({
        where: (clips, { and, eq, like }) => and(like(clips.streamer, streamer), eq(clips.guildId, interaction.guild_id)),
      })
      if (!stream)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('You are not subscribed to this streamer', env)] })

      await useDB(env).delete(tables.clips).where(and(like(tables.clips.streamer, streamer), eq(tables.clips.guildId, interaction.guild_id)))

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`Unsubscribed to \`${streamer}\` for clip notifications`, env)] })
    }
    case 'edit': {
      const server = interaction.guild_id
      const edit = interaction.data.options.find(option => option.name === 'edit')
      if (!edit || !('options' in edit) || !edit.options)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const streamerOption = edit.options.find(option => option.name === 'streamer')
      const streamer = streamerOption && 'value' in streamerOption ? streamerOption.value as string : undefined
      if (!streamer)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('Invalid arguments', env)] })
      const dbClip = await useDB(env).query.clips.findFirst({
        where: (clips, { and, eq, like }) => and(like(clips.streamer, streamer), eq(clips.guildId, interaction.guild_id)),
      })
      if (!dbClip)
        return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildErrorEmbed('You are not subscribed to this streamer', env)] })

      const channel = edit.options.find(option => option.name === 'discord-channel')
      if (channel)
        await useDB(env).update(tables.clips).set({ channelId: String('value' in channel ? channel.value : '') }).where(and(like(tables.clips.streamer, streamer), eq(tables.clips.guildId, server)))

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(`Edited \`${streamer}\` for clip notifications`, env)] })
    }
    case 'list': {
      const clips = await useDB(env).query.clips.findMany({
        where: (clips, { eq }) => eq(clips.guildId, interaction.guild_id),
      })
      let clipsList = 'Not subscribed to recive clip notifications for any streams'
      if (clips.length > 0)
        clipsList = clips.map(stream => `**${stream.streamer}** - <#${stream.channelId}>`).join('\n')

      return await updateInteraction(interaction, env.DISCORD_APPLICATION_ID, { embeds: [buildSuccessEmbed(clipsList, env, { title: `<:twitch:1404661243373031585> Clip Notifications` })] })
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
                content: '# <a:CLIPPERS:1357111588644982997> Available Commands for Clip Notifications',
              },
              {
                type: 10,
                content: CLIPS_HELP_MESSAGE,
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
}

export default {
  command: TWITCH_CLIPS_COMMAND,
  handler,
} satisfies DiscordAPIApplicationCommand
