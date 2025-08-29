# DinkDonk Bot
[![License](https://img.shields.io/github/license/svglol/dinkdonkbot)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/svglol/dinkdonkbot?style=social)](https://github.com/svglol/dinkdonkbot/stargazers)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F68212?logo=cloudflare)](https://workers.cloudflare.com)
[![CI](https://github.com/svglol/dinkdonkbot/actions/workflows/ci.yml/badge.svg)](https://github.com/svglol/dinkdonkbot/actions/workflows/ci.yml)
[![Discord](https://img.shields.io/badge/Join-Discord-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.gg/NuY7Tnrb6F)

A powerful Discord bot for Twitch & Kick notifications, emote management, and interactive games, running on Cloudflare Workers.

## Features
- **Live Stream Alerts**: Get instant notifications when your favorite Twitch & Kick streamers go live
- **Multistream Support**: Merge Twitch and Kick notifications for streamers who broadcast on both platforms
- **Clip Highlights**: Stay updated with the best moments from your favorite streamers posted hourly
- **Emote Management**: Easily add emotes from 7TV or other Discord servers to your own server
- **Interactive Games**: Play hangman, rock paper scissors, and more with your community
- **Utility Commands**: Weather, time, dice rolling, and timestamp generation

## Get Started
[![Add DinkDonk Bot](https://img.shields.io/badge/Add%20to-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/application-directory/1227866873220173824)
[![Documentation](https://img.shields.io/badge/Read-Documentation-blue?style=for-the-badge&logo=gitbook&logoColor=white)](https://svglol.github.io/dinkdonkbot/)
[![Join Discord Server](https://img.shields.io/badge/Join%20Discord-Server-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/NuY7Tnrb6F)
[![Ko-fi](https://img.shields.io/badge/Support%20us-fc4c58?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/svglol)

---

## Quickstart
Get started in **4 easy steps** with the `/quickstart` command in your Discord server:

### Step 1: Install the Bot
Add DinkDonk Bot to your Discord server using [this link](https://discord.com/application-directory/1227866873220173824).

### Step 2: Add a Streamer
Add a Twitch or Kick streamer and choose which channel to post notifications in.
- Twitch: `/stream twitch add <streamer> <channel>`
- Kick: `/stream kick add <streamer> <channel>`

### Step 3: Multistream Notifications
Link Twitch & Kick streamers together to reduce spam by merging notifications.
*Note: You must have both Twitch and Kick alerts set up for this to work, and both need to post to the same channel.*
- `/stream multistream link <twitch-streamer> <kick-streamer>`

### Step 4: Test Your Notification *(Optional)*
Preview what notifications will look like before going live.
- `/stream twitch test <streamer>`
- `/stream kick test <streamer>`

### Step 5: Explore More Features
- **Clips**: Get hourly highlights with `/clips add`
- **Emotes**: Add emotes from other servers with `/emote add`
- **Games**: Play `/hangman`, `/rps`, `/coinflip`, and more

### Need Help?
Use `/help` for detailed commands or join our [Discord server](https://discord.gg/NuY7Tnrb6F) for support!

---

## Commands

### 🟪 Twitch Stream Alerts
- `/stream twitch add <streamer> <discord-channel> [ping-role] [live-message] [offline-message] [cleanup]` - Add a Twitch streamer to receive notifications for going online
- `/stream twitch remove <streamer>` - Remove a Twitch streamer from receiving notifications for going online or offline
- `/stream twitch edit <streamer> [discord-channel] [ping-role] [remove-ping-role] [live-message] [offline-message] [cleanup]` - Edit a Twitch streamer's settings
- `/stream list` - List the Twitch streamers that you are subscribed to
- `/stream twitch test <streamer> [message-type] [multistream] [global]` - Test the notification for a streamer (online/offline)
- `/stream twitch details <streamer>` - Show the details for a streamer you are subscribed to
- `/stream help` - Show help for the Twitch command and its subcommands

### 🟩 Kick Stream Alerts
- `/stream kick add <streamer> <discord-channel> [ping-role] [live-message] [offline-message] [cleanup]` - Add a Kick streamer to receive notifications for going online
- `/stream kick remove <streamer>` - Remove a Kick streamer from receiving notifications for going online
- `/stream kick edit <streamer> [discord-channel] [ping-role] [remove-ping-role]  [live-message] [offline-message] [cleanup]` - Edit a Kick streamer's settings
- `/stream list` - View your subscribed Kick streamers
- `/stream kick test <streamer> [message-type] [multistream] [global]` - Test the notification for a streamer (online/offline)
- `/stream kick details <streamer>` - Show the details for a streamer you are subscribed to
- `/stream help` - Show help for the Kick command

### 🔗 Multistream Notifications
- `/stream multistream link <twitch-streamer> <kick-streamer> [priority] [late-merge]` - Setup a multistream connection between a Twitch & Kick channel
- `/stream multistream unlink [twitch-streamer] [kick-streamer]` - Remove a multistream connection between a Twitch & Kick channel
- `/stream multistream edit [twitch-streamer] [kick-streamer] [priority] [late-merge]` - Edit a multistream setup settings
- `/stream list` - List your currently set up multistreams
- `/stream help` - Show help for the multistream command

### 🎬 Twitch Clip Highlights
- `/clips add <streamer> <discord-channel>` - Subscribe to Twitch clips from a streamer to be posted hourly
- `/clips remove <streamer>` - Unsubscribe from Twitch clips from a streamer
- `/clips edit <streamer> <discord-channel>` - Update the settings for a Twitch clip subscription
- `/clips list` - View your subscribed Twitch clip channels
- `/clips help` - Show help for the Twitch clips command

### 🥳 Emote Management
- `/emote add <url_or_emoji>` - Add an emote from another Discord server or 7TV
- `/emote help` - Show help for the emote command
- **Context Menu** - `Steal Emote/Sticker` - Steal an emote or sticker from a message

### 🎮 Games & Fun
- `/hangman` - Create a community game of hangman
- `/rps <opponent>` - Challenge someone to a game of rock paper scissors
- `/coinflip` - Flip a coin
- `/roll [dice] [sides]` - Roll some dice (1-10 dice, 2-1000 sides each)
- `/randomemote` - Post a random emote from the current server
- `/dinkdonk` - Get dinkdonked

### 🔧 Utility Commands
- `/weather <location>` - Get the current weather for a location
- `/time <location>` - Get the current time for a location
- `/timestamp <date> <time> <utc_offset> [style]` - Create a Discord timestamp for a specific date/time and UTC offset

### ℹ️ Bot Information
- `/help` - Show help for DinkDonk Bot
- `/commands` - List all commands for DinkDonk Bot
- `/invite` - Get an invite link to add the bot to your server

## Development
This bot is built using Cloudflare Workers and is based on the [Discord Cloudflare Sample App](https://github.com/discord/cloudflare-sample-app).

## Support
Need help or have questions? Join our [Discord server](https://discord.gg/NuY7Tnrb6F) or check out the [documentation](https://svglol.github.io/dinkdonkbot/).

If you find DinkDonk Bot useful, consider [supporting us on Ko-fi](https://ko-fi.com/svglol)!
