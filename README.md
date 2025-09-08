# DinkDonk Bot
[![License](https://img.shields.io/github/license/svglol/dinkdonkbot)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/svglol/dinkdonkbot?style=social)](https://github.com/svglol/dinkdonkbot/stargazers)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F68212?logo=cloudflare)](https://workers.cloudflare.com)
[![CI](https://github.com/svglol/dinkdonkbot/actions/workflows/ci.yml/badge.svg)](https://github.com/svglol/dinkdonkbot/actions/workflows/ci.yml)
[![Discord](https://img.shields.io/badge/Join-Discord-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.gg/NuY7Tnrb6F)

A powerful Discord bot for Twitch & Kick notifications, emote management, and interactive games, running on Cloudflare Workers.

## Features
- **Live Stream Notifications**: Get instant notifications when your favorite Twitch & Kick streamers go live
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
- Twitch: `/streams twitch add <streamer> <channel>`
- Kick: `/streams kick add <streamer> <channel>`

### Step 3: Multistream Notifications
Link Twitch & Kick streamers together to reduce spam by merging notifications.
*Note: You must have both Twitch and Kick notifications set up for this to work, and both need to post to the same channel.*
- `/streams multistream link <twitch-streamer> <kick-streamer>`

### Step 4: Test Your Notification *(Optional)*
Preview what notifications will look like before going live.
- `/streams twitch test <streamer>`
- `/streams kick test <streamer>`

### Step 5: Explore More Features
- **Clips**: Get hourly highlights with `/clips twitch add`
- **Emotes**: Add emotes from other servers with `/emote add`
- **Games**: Play `/hangman`, `/rps`, `/coinflip`, and more

### Need Help?
Use `/help` for detailed commands or join our [Discord server](https://discord.gg/NuY7Tnrb6F) for support!

---

## Commands

### 🟪 Twitch Stream Notifications
- `/streams twitch add <streamer> <discord-channel> [ping-role] [live-message] [offline-message] [cleanup]` - Add a Twitch streamer to receive notifications for going online
- `/streams twitch remove <streamer>` - Remove a Twitch streamer from receiving notifications for going online or offline
- `/streams twitch edit <streamer> [discord-channel] [ping-role] [remove-ping-role] [live-message] [offline-message] [cleanup]` - Edit a Twitch streamer's settings
- `/streams list` - List the Twitch streamers that you are subscribed to
- `/streams twitch test <streamer> [message-type] [multistream] [global]` - Test the notification for a streamer (online/offline)
- `/streams twitch details <streamer>` - Show the details for a streamer you are subscribed to
- `/streams help` - Show help for the Twitch command and its subcommands

### 🟩 Kick Stream Notifications
- `/streams kick add <streamer> <discord-channel> [ping-role] [live-message] [offline-message] [cleanup]` - Add a Kick streamer to receive notifications for going online
- `/streams kick remove <streamer>` - Remove a Kick streamer from receiving notifications for going online
- `/streams kick edit <streamer> [discord-channel] [ping-role] [remove-ping-role]  [live-message] [offline-message] [cleanup]` - Edit a Kick streamer's settings
- `/streams list` - View your subscribed Kick streamers
- `/streams kick test <streamer> [message-type] [multistream] [global]` - Test the notification for a streamer (online/offline)
- `/streams kick details <streamer>` - Show the details for a streamer you are subscribed to
- `/streams help` - Show help for the Kick command

### 🔗 Multistream Notifications
- `/streams multistream link <twitch-streamer> <kick-streamer> [priority] [late-merge]` - Setup a multistream connection between a Twitch & Kick channel
- `/streams multistream unlink [twitch-streamer] [kick-streamer]` - Remove a multistream connection between a Twitch & Kick channel
- `/streams multistream edit [twitch-streamer] [kick-streamer] [priority] [late-merge]` - Edit a multistream setup settings
- `/streams list` - List your currently set up multistreams
- `/streams help` - Show help for the multistream command

### 🎬 Twitch Clip Highlights
- `/clips twitch add <streamer> <discord-channel>` - Subscribe to Twitch clips from a streamer to be posted hourly
- `/clips twitch remove <streamer>` - Unsubscribe from Twitch clips from a streamer
- `/clips twitch edit <streamer> <discord-channel>` - Update the settings for a Twitch clip subscription
- `/clips twitch list` - View your subscribed Twitch clip channels
- `/clips twitch help` - Show help for the Twitch clips command

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
This bot is built to run on Cloudflare Workers and was originally based on the [Discord Cloudflare Sample App](https://github.com/discord/cloudflare-sample-app).

Enviroment Variables
```
DISCORD_APPLICATION_ID: "your_discord_app_id"
DISCORD_PUBLIC_KEY: "your_discord_app_public_key"
DISCORD_TOKEN: "your_discord_bot_token"
TWITCH_CLIENT_ID: "your_twitch_client_id"
TWITCH_CLIENT_SECRET: "your_twitch_client_secret"
TWITCH_EVENT_SECRET: "your_twitch_event_secret"
WEBHOOK_URL: "https://your_ngrok_url/
KICK_CLIENT_ID: "your_kick_client_id"
KICK_CLIENT_SECRET: "your_kick_client_secret"
ANALYTICS_DATASET: "dinkdonk_bot_events" // used for analytics (not required for dev)
ACCOUNT_ID: "your_cloudflare_account_id" // used for analytics (not required for dev)
API_TOKEN: "your_cloudflare_api_token" // used for analytics (not required for dev)
DISCORD_PROXY: "https://discord.com" // we use a proxy on production, but can be set to "https://discord.com" for local development
```

## Running Locally
```bash
pnpm run dev
```

```bash
pnpm run ngrok
```

```bash
Edit your Discord Application Interactions Endpoint URL to match ngrok URL
Edit Kick.com application webhooks url to match ngrok URL + /kick-eventsub
Edit WEBHOOK_URL environment variable to match ngrok URL
```

## Support
Need help or have questions? Join our [Discord server](https://discord.gg/NuY7Tnrb6F) or check out the [documentation](https://svglol.github.io/dinkdonkbot/).

If you find DinkDonk Bot useful, consider [supporting us on Ko-fi](https://ko-fi.com/svglol)!
