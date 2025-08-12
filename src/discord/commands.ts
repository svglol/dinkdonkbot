/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */

const PERMISSIONS = {
  // Basic permissions
  CREATE_INSTANT_INVITE: '1',
  KICK_MEMBERS: '2',
  BAN_MEMBERS: '4',
  ADMINISTRATOR: '8',
  MANAGE_CHANNELS: '16',
  MANAGE_GUILD: '32',

  // Message permissions
  ADD_REACTIONS: '64',
  VIEW_AUDIT_LOG: '128',
  PRIORITY_SPEAKER: '256',
  STREAM: '512',
  VIEW_CHANNEL: '1024',
  SEND_MESSAGES: '2048',
  SEND_TTS_MESSAGES: '4096',
  MANAGE_MESSAGES: '8192',
  EMBED_LINKS: '16384',
  ATTACH_FILES: '32768',
  READ_MESSAGE_HISTORY: '65536',
  MENTION_EVERYONE: '131072',
  USE_EXTERNAL_EMOJIS: '262144',
  VIEW_GUILD_INSIGHTS: '524288',

  // Voice permissions
  CONNECT: '1048576',
  SPEAK: '2097152',
  MUTE_MEMBERS: '4194304',
  DEAFEN_MEMBERS: '8388608',
  MOVE_MEMBERS: '16777216',
  USE_VAD: '33554432',

  // Advanced permissions
  CHANGE_NICKNAME: '67108864',
  MANAGE_NICKNAMES: '134217728',
  MANAGE_ROLES: '268435456',
  MANAGE_WEBHOOKS: '536870912',
  MANAGE_EMOJIS_AND_STICKERS: '1073741824',
  USE_APPLICATION_COMMANDS: '2147483648',
  REQUEST_TO_SPEAK: '4294967296',
  MANAGE_EVENTS: '8589934592',
  MANAGE_THREADS: '17179869184',
  CREATE_PUBLIC_THREADS: '34359738368',
  CREATE_PRIVATE_THREADS: '68719476736',
  USE_EXTERNAL_STICKERS: '137438953472',
  SEND_MESSAGES_IN_THREADS: '274877906944',
  USE_EMBEDDED_ACTIVITIES: '549755813888',
  MODERATE_MEMBERS: '1099511627776',
}

export const INVITE_COMMAND = {
  name: 'invite',
  description: 'Get an invite link to add the bot to your server',
}

export const DINKDONK_COMMAND = {
  name: 'dinkdonk',
  description: 'Get dinkdonked',
}

export const TWITCH_COMMAND = {
  name: 'twitch',
  description: 'Twitch stream notifications',
  default_member_permissions: PERMISSIONS.ADMINISTRATOR,
  dm_permission: false,
  options: [{
    type: 1,
    name: 'add',
    description: 'Add a Twitch streamer to receive notifications for going online',
    dm_permission: false,
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer to add',
      required: true,
    }, {
      type: 7,
      name: 'discord-channel',
      description: 'The discord channel to post to when the streamer goes live',
      required: true,
      channel_types: [0],
    }, {
      type: 8,
      name: 'ping-role',
      description: 'What role to @ when the streamer goes live',
    }, {
      type: 3,
      name: 'live-message',
      description: 'The message to post when the streamer goes live',
    }, {
      type: 3,
      name: 'offline-message',
      description: 'The message to post when the streamer goes offline',
    }],
  }, {
    type: 1,
    name: 'remove',
    description: 'Remove a Twitch streamer from receiving notifications for going online or offline',
    dm_permission: false,
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer to remove',
      required: true,
    }],
  }, {
    type: 1,
    name: 'edit',
    description: 'Edit a Twitch streamer\'s settings',
    dm_permission: false,
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer to edit',
      required: true,
    }, {
      type: 7,
      name: 'discord-channel',
      description: 'The discord channel to post to when the streamer goes live',
      channel_types: [0],
    }, {
      type: 8,
      name: 'ping-role',
      description: 'What role/who to @ when the streamer goes live',
    }, {
      type: 3,
      name: 'live-message',
      description: 'The message to post when the streamer goes live',
    }, {
      type: 3,
      name: 'offline-message',
      description: 'The message to post when the streamer goes offline',
    }],
  }, {
    type: 1,
    name: 'list',
    description: 'List the twitch streamers that you are subscribed to',
    dm_permission: false,
  }, {
    type: 1,
    name: 'test',
    description: 'Test the notification for a streamer',
    dm_permission: false,
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer to test',
      required: true,
    }, {
      type: 5,
      name: 'global',
      description: 'Show the notification for everyone in the server',
    }],
  }, {
    type: 1,
    name: 'details',
    description: 'Show the details for a streamer you are subscribed to',
    dm_permission: false,
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer to show',
      required: true,
    }],
  }, {
    type: 1,
    name: 'help',
    description: 'Show help for the twitch command and its subcommands',
    dm_permission: false,
  }],
}

export const EMOTE_COMMAND = {
  name: 'emote',
  description: 'Manage discord custom emotes',
  default_member_permissions: PERMISSIONS.MANAGE_EMOJIS_AND_STICKERS,
  dm_permission: false,
  options: [
    {
      type: 1,
      name: 'add',
      description: 'Add an emote from another discord server or 7tv',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'url_or_emoji',
        description: 'The URL or emoji to add',
        required: true,
      }],
    },
    {
      type: 1,
      name: 'help',
      description: 'Show help for the emote command',
      dm_permission: false,
    },
  ],
}

export const STEAL_EMOTE_COMMAND = {
  name: 'Steal Emote',
  type: 3,
  default_member_permissions: PERMISSIONS.MANAGE_EMOJIS_AND_STICKERS,
  dm_permission: false,
}

export const TWITCH_CLIPS_COMMAND = {
  name: 'clips',
  description: 'Manage Twitch clip subscriptions for streamers to be posted hourly',
  default_member_permissions: PERMISSIONS.ADMINISTRATOR,
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

export const KICK_COMMAND = {
  name: 'kick',
  description: 'Kick Stream Notifications',
  default_member_permissions: PERMISSIONS.ADMINISTRATOR,
  dm_permission: false,
  options: [
    {
      type: 1,
      name: 'add',
      description: 'Add a Kick streamer to receive notifications for going online',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'streamer',
        description: 'The name of the streamer to add',
        required: true,
      }, {
        type: 7,
        name: 'discord-channel',
        description: 'The discord channel to post to when the streamer goes live',
        required: true,
        channel_types: [0],
      }, {
        type: 8,
        name: 'ping-role',
        description: 'What role to @ when the streamer goes live',
      }, {
        type: 3,
        name: 'live-message',
        description: 'The message to post when the streamer goes live',
      }, {
        type: 3,
        name: 'offline-message',
        description: 'The message to post when the streamer goes offline',
      }],
    },
    {
      type: 1,
      name: 'remove',
      description: 'Remove a Kick streamer from receiving notifications for going online',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'streamer',
        description: 'The name of the streamer to remove',
        required: true,
      }],
    },
    {
      type: 1,
      name: 'list',
      description: 'View your subscribed Kick streamers',
      dm_permission: false,
    },
    {
      type: 1,
      name: 'help',
      description: 'Show help for the kick command',
      dm_permission: false,
    },
    {
      type: 1,
      name: 'details',
      description: 'Show the details for a streamer you are subscribed to',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'streamer',
        description: 'The name of the streamer to show',
        required: true,
      }],
    },
    {
      type: 1,
      name: 'edit',
      description: 'Edit a Kick streamer\'s settings',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'streamer',
        description: 'The name of the streamer to edit',
        required: true,
      }, {
        type: 7,
        name: 'discord-channel',
        description: 'The discord channel to post to when the streamer goes live',
        channel_types: [0],
      }, {
        type: 8,
        name: 'ping-role',
        description: 'What role/who to @ when the streamer goes live',
      }, {
        type: 3,
        name: 'live-message',
        description: 'The message to post when the streamer goes live',
      }, {
        type: 3,
        name: 'offline-message',
        description: 'The message to post when the streamer goes offline',
      }],
    },
    {
      type: 1,
      name: 'test',
      description: 'Test the notification for a streamer',
      dm_permission: false,
      options: [{
        type: 3,
        name: 'streamer',
        description: 'The name of the streamer to test',
        required: true,
      }, {
        type: 5,
        name: 'global',
        description: 'Show the notification for everyone in the server',
      }],
    },
  ],
}

export const HELP_COMMAND = {
  name: 'help',
  description: 'Show help for DinkDonk Bot',
  dm_permission: false,
}
