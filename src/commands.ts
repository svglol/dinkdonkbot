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
    description: 'Add a twitch streamer',
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer',
      required: true,
    }, {
      type: 7,
      name: 'discord-channel',
      description: 'The discord channel to post to',
      required: true,
      channel_types: [0],
    }, {
      type: 8,
      name: 'ping-role',
      description: 'What role to @ when the streamer goes live',
    }, {
      type: 3,
      name: 'message',
      description: 'The message to post when the streamer goes live',
    }],
  }, {
    type: 1,
    name: 'remove',
    description: 'Remove a twitch streamer',
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer',
      required: true,
    }],
  }, {
    type: 1,
    name: 'edit',
    description: 'Edit a twitch streamer',
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer',
      required: true,
    }, {
      type: 7,
      name: 'discord-channel',
      description: 'The discord channel to post to',
      channel_types: [0],
    }, {
      type: 8,
      name: 'ping-role',
      description: 'What role/who to @ when the streamer goes live',
    }, {
      type: 3,
      name: 'message',
      description: 'The message to post when the streamer goes live',
    }],
  }, {
    type: 1,
    name: 'list',
    description: 'List the twitch streamers',
  }, {
    type: 1,
    name: 'test',
    description: 'Test the notification for a streamer',
    options: [{
      type: 3,
      name: 'streamer',
      description: 'The name of the streamer',
      required: true,
    }],
  }],
}
