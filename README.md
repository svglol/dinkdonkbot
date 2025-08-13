# DinkDonk Bot
[![License](https://img.shields.io/github/license/svglol/dinkdonkbot)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/svglol/dinkdonkbot?style=social)](https://github.com/svglol/dinkdonkbot/stargazers)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F68212?logo=cloudflare)](https://workers.cloudflare.com)
[![CI](https://github.com/svglol/dinkdonkbot/actions/workflows/ci.yml/badge.svg)](https://github.com/svglol/dinkdonkbot/actions/workflows/ci.yml)

A powerful Discord bot for Twitch & Kick notifications and emote management, running on Cloudflare Workers.

## Features
- **Live Stream Alerts**: Get instant notifications when your favorite Twitch & Kick streamers go live
- **Clip Highlights**: Stay updated with the best moments from your favorite streamers
- **Emote Uploader**: Easily add emotes from 7TV or other Discord servers to your own server

## Get Started
[![Add DinkDonk Bot](https://img.shields.io/badge/Add%20to-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/oauth2/authorize?client_id=1227866873220173824&permissions=8797166895104&scope=applications.commands+bot)
[![Documentation](https://img.shields.io/badge/Read-Documentation-blue?style=for-the-badge&logo=gitbook&logoColor=white)](https://svglol.github.io/dinkdonkbot/)
[![Ko-fi](https://img.shields.io/badge/Support%20us-fc4c58?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/svglol)


## Commands

### 🟪 Twitch Stream Alerts
- `/twitch add <streamer> <discord-channel> [ping-role] [live-message] [offline-message]` - Add streamer notifications
- `/twitch remove <streamer>` - Stop notifications for a streamer
- `/twitch edit <streamer> [discord-channel] [ping-role] [live-message] [offline-message]` - Update settings
- `/twitch list` - View all subscribed streamers
- `/twitch test <streamer> [global]` - Preview notification appearance
- `/twitch details <streamer>` - See detailed streamer settings
- `/twitch help` - Display command instructions

### 🟩 Kick Stream Alerts
- `/kick add <streamer> <discord-channel> [ping-role] [live-message] [offline-message]` - Add streamer notifications
- `/kick remove <streamer>` - Stop notifications for a streamer
- `/kick edit <streamer> [discord-channel] [ping-role] [live-message] [offline-message]` - Update settings
- `/kick list` - View all subscribed streamers
- `/kick test <streamer> [global]` - Preview notification appearance
- `/kick details <streamer>` - See detailed streamer settings
- `/kick help` - Display command instructions

### 🎬 Twitch Clip Highlights
- `/clips add <streamer> <discord-channel>` - Subscribe to a streamer's clips
- `/clips remove <streamer>` - Unsubscribe from clip notifications
- `/clips edit <streamer> <discord-channel>` - Change clip notification channel
- `/clips list` - View all clip subscriptions
- `/clips help` - Get help with clip commands

### 🥳 Emote Management
- `/emote add <url_or_emoji>` - Add emotes from other servers or 7TV to your own server
- Context Menu - `emote steal` - Steal an emote from a message

### ✨ Additional Commands
- `/invite` - Generate an invite link to add DinkDonk Bot to another Discord server
- `/dinkdonk` - Get DinkDonked

## Development
This bot is built using Cloudflare Workers and is based on the [Discord Cloudflare Sample App](https://github.com/discord/cloudflare-sample-app).
