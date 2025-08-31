---
title: ''
description: 'DinkDonk Bot is a Discord Bot that helps you stay updated with Twitch and Kick streams, clips, multistream notifications, interactive games, and Discord emotes effortlessly.'
ogImage:
  component: OgImageDefault
  props:
    title: 'DinkDonk Bot'
    description: 'DinkDonk Bot is a Discord Bot that helps you stay updated with Twitch and Kick streams, clips, multistream notifications, interactive games, and Discord emotes effortlessly.'
---

::hero
---
img: "./DinkDonk.webp"
alt: "DinkDonk Animated Logo"
buttons:
  - label: "Get DinkDonk Bot"
    link: "https://discord.com/application-directory/1227866873220173824"
    icon: "material-symbols:rocket-launch"
    color: "primary"
  - label: "View on Github"
    link: "https://github.com/svglol/dinkdonkbot"
    icon: "uil:github"
    color: "neutral"
---

#title
DinkDonk Bot

#subtitle
Your all-in-one Discord bot for Twitch and Kick notifications, multistream support, interactive games, and Discord emotes.

#cards
::card{:icon="fa6-solid:bell"}

#title
Live Stream Notifications

#subtitle
Never miss a stream! Get instant notifications when your favorite Twitch and Kick streamers go live, with full customization options.
::

::card{:icon="fa6-solid:link"}

#title
Multistream Support

#subtitle
Merge notifications for streamers who broadcast on both Twitch and Kick into a single unified notification.
::

::card{:icon="fa6-solid:film"}

#title
Clip Highlights

#subtitle
Stay updated with the best moments! Receive hourly updates with new clips from your favorite Twitch streamers.
::

::card{:icon="fa6-solid:face-smile"}

#title
Emote Management

#subtitle
Easily add emotes from 7TV or other Discord servers to your own server in just a few clicks.
::

::card{:icon="fa6-solid:gamepad"}

#title
Interactive Games

#subtitle
Play community games like hangman, rock paper scissors, dice rolling, and more to engage your server members.
::

::card{:icon="fa6-solid:wrench"}

#title
Utility Commands

#subtitle
Get weather updates, current time, create Discord timestamps, and flip coins with handy utility commands.
::

::

::detailed
#title
Bot Commands

#content
::card{:disableSpotlight="true"}

#title
🟪 Twitch Stream Notifications

#subtitle
`/streams twitch add <streamer> <discord-channel> [ping-role] [live-message] [offline-message] [cleanup]` - Add Twitch streamer notifications
`/streams twitch remove <streamer>` - Remove Twitch streamer notifications
`/streams twitch edit <streamer> [discord-channel] [ping-role] [remove-ping-role] [live-message] [offline-message] [cleanup]` - Edit Twitch streamer settings
`/streams list` - View all subscribed Twitch streamers
`/streams twitch test <streamer> [message-type] [multistream] [global]` - Test notification appearance
`/streams twitch details <streamer>` - See detailed Twitch streamer settings
`/streams help` - Display Twitch command instructions

#description
Set up Twitch stream notifications for your Discord server. Get notified when your favorite streamers go live or offline with customizable messages and ping roles.
::

::card{:disableSpotlight="true"}

#title
🟩 Kick Stream Notifications

#subtitle
`/streams kick add <streamer> <discord-channel> [ping-role] [live-message] [offline-message] [cleanup]` - Add Kick streamer notifications
`/streams kick remove <streamer>` - Remove Kick streamer notifications
`/streams kick edit <streamer> [discord-channel] [ping-role] [live-message] [offline-message] [cleanup]` - Edit Kick streamer settings
`/streams list` - View all subscribed Kick streamers
`/streams kick test <streamer> [message-type] [multistream] [global]` - Test notification appearance
`/streams kick details <streamer>` - See detailed Kick streamer settings
`/streams help` - Display Kick command instructions

#description
Monitor Kick streamers and get real-time notifications when they start or stop streaming. Perfect for keeping up with the latest live content on Kick.
::

::card{:disableSpotlight="true"}

#title
🔗 Multistream Notifications

#subtitle
`/streams multistream link <twitch-streamer> <kick-streamer> [priority] [late-merge]` - Link Twitch and Kick streamers for unified notifications
`/streams multistream unlink [twitch-streamer] [kick-streamer]` - Remove multistream connection
`/streams multistream edit [twitch-streamer] [kick-streamer] [priority] [late-merge]` - Edit multistream settings
`/streams list` - View all multistream connections
`/streams help` - Get help with multistream commands

#description
Merge notifications for streamers who broadcast on both Twitch and Kick into a single unified message. Set platform priority and configure late-merge options for maximum flexibility.
::

::card{:disableSpotlight="true"}

#title
🎬 Twitch Clip Highlights

#subtitle
`/clips twitch add <streamer> <discord-channel>` - Subscribe to hourly Twitch clips from a streamer
`/clips twitch remove <streamer>` - Unsubscribe from Twitch clip notifications
`/clips twitch edit <streamer> <discord-channel>` - Change clip notification channel
`/clips twitch list` - View all clip subscriptions
`/clips twitch help` - Get help with clip commands

#description
Stay up to date with the best moments from your favorite streamers. Automatically receive the latest Twitch clips posted hourly to keep your community engaged with highlights.
::

::card{:disableSpotlight="true"}

#title
🥳 Emote Management

#subtitle
`/emote add <url_or_emoji>` - Add emotes from other Discord servers or 7TV
`/emote help` - Show emote command help
**Context Menu:** `Steal Emote/Sticker` - Steal emotes/stickers from messages

#description
Expand your server's emote collection effortlessly. Add emotes from 7TV, other Discord servers, or steal them directly from messages using the context menu. Perfect for building a diverse emote library.
::

::card{:disableSpotlight="true"}

#title
🎮 Games & Fun

#subtitle
`/hangman` - Create a community hangman game
`/rps <opponent>` - Challenge someone to rock paper scissors
`/coinflip` - Flip a coin
`/roll [dice] [sides]` - Roll dice (1-10 dice, 2-1000 sides each)
`/randomemote` - Post a random server emote
`/dinkdonk` - Get DinkDonked

#description
Keep your community engaged with interactive games and fun commands. Challenge members to games, roll dice for decisions, or just have fun with random emotes and coin flips.
::

::card{:disableSpotlight="true"}

#title
🔧 Utility Commands

#subtitle
`/weather <location>` - Get current weather for a location
`/time <location>` - Get current time for a location
`/timestamp <date> <time> <utc_offset> [style]` - Create Discord timestamps

#description
Access helpful utility tools right from Discord. Check weather conditions, get time information for any location, and create properly formatted Discord timestamps for events and scheduling.
::

::card{:disableSpotlight="true"}

#title
ℹ️ Bot Information

#subtitle
`/help` - Show general bot help
`/commands` - List all available commands
`/invite` - Get bot invite link for other servers

#description
Get help and information about DinkDonk Bot. Access comprehensive help documentation, view all available commands, or generate invite links to add the bot to additional Discord servers.
::

::
