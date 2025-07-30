---
title: ''
description: 'DinkDonk Bot is a Discord Bot that helps you stay updated with Twitch and Kick streams, clips, and Discord emotes effortlessly.'
ogImage:
  component: OgImageDefault
  props:
    title: 'DinkDonk Bot'
    description: 'DinkDonk Bot is a Discord Bot that helps you stay updated with Twitch and Kick streams, clips, and Discord emotes effortlessly.'
---

::hero
---
img: "./DinkDonk.webp"
alt: "DinkDonk Animated Logo"
buttons:
  - label: "Get DinkDonk Bot"
    link: "https://discord.com/oauth2/authorize?client_id=1227866873220173824&permissions=8797166895104&scope=applications.commands+bot"
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
Your all-in-one Discord bot for Twitch and Kick notifications and Discord emotes.

#cards
::card{:icon="fa6-solid:bell"}

#title
Live Stream Alerts

#subtitle
Never miss a stream! Get instant notifications when your favorite Twitch and Kick streamers go live.
::

::card{:icon="fa6-solid:film"}

#title
Clip Highlights

#subtitle
Stay updated with the best moments! Receive alerts whenever new clips of your favorite streamers are created.
::

::card{:icon="fa6-solid:face-smile"}

#title
Emote Uploader

#subtitle
Easily add emotes from 7TV or other Discord servers to your own server in just a few clicks.
::

::

::detailed
#title
Bot Commands

#content
::card{:disableSpotlight="true"}

#title
🟪 Twitch Stream Alerts

#subtitle
`/twitch add <streamer> <discord-channel> [ping-role] [live-message] [offline-message]` - Add streamer notifications
`/twitch remove <streamer>` - Stop notifications for a streamer
`/twitch edit <streamer> [discord-channel] [ping-role] [live-message] [offline-message]` - Update settings
`/twitch list` - View all subscribed streamers
`/twitch test <streamer> [global]` - Preview notification appearance
`/twitch details <streamer>` - See detailed streamer settings
`/twitch help` - Display command instructions
::

::card{:disableSpotlight="true"}

#title
🟩 Kick Stream Alerts

#subtitle
`/kick add <streamer> <discord-channel> [ping-role] [live-message] [offline-message]` - Add streamer notifications
`/kick remove <streamer>` - Stop notifications for a streamer
`/kick edit <streamer> [discord-channel] [ping-role] [live-message] [offline-message]` - Update settings
`/kick list` - View all subscribed streamers
`/kick test <streamer> [global]` - Preview notification appearance
`/kick details <streamer>` - See detailed streamer settings
`/kick help` - Display command instructions
::

::card{:disableSpotlight="true"}

#title
🎬 Twitch Clip Highlights

#subtitle
`/clips add <streamer> <discord-channel>` - Subscribe to a streamer's clips
`/clips remove <streamer>` - Unsubscribe from clip notifications
`/clips edit <streamer> <discord-channel>` - Change clip notification channel
`/clips list` - View all clip subscriptions
`/clips help` - Get help with clip commands
::

::card{:disableSpotlight="true"}

#title
🥳 Emote Management

#subtitle
`/emote add <url_or_emoji>` - Add emotes from other servers or 7TV to your own server
::

::card{:disableSpotlight="true"}

#title
✨ Additional Commands

#subtitle
`/invite` - Generate an invite link to add DinkDonk Bot to another Discord server
`/dinkdonk` - Get DinkDonked
::

::
