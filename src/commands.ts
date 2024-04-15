/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */

export const INVITE_COMMAND = {
  name: 'invite',
  description: 'Get an invite link to add the bot to your server',
}

export const TWITCH_COMMAND = {
  name: 'twitch',
  description: 'Twitch streamer notifications',
  default_member_permissions: '0',
  options: [{
    type: 1,
    name: 'add',
    description: 'Add a Twitch streamer to receive notifications for going online or offline',
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
  }, {
    type: 1,
    name: 'test',
    description: 'Test the notification for a streamer',
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
  }],
}
