---
title: Privacy Policy
navigation:
  icon: i-lucide-shield-check

sitemap:
  lastmod: 2026-02-12
---
## Introduction

This Privacy Policy describes how DinkDonk Bot ("we", "our", or "the Bot") collects, uses, and handles your information when you use our Discord bot. We are committed to ensuring the privacy and security of your data while providing you with a feature-rich Discord bot experience.

## Information We Collect

### 1. Discord Server Data
- Server IDs and names
- Channel IDs and names
- Role IDs (for notification pings)
- Message IDs (for notification management)
- Custom message templates that you configure for stream notifications (live and offline messages)

### 2. Twitch Integration Data
- Twitch usernames/channel names and broadcaster IDs that you choose to follow
- Public Twitch stream information (stream title, game, viewer count, etc.)
- Public Twitch clip information (clip titles, URLs, creator names)
- Stream status (online/offline) for notification purposes
- Clip creation timestamps for hourly clip aggregation
- Stream and VOD metadata used to display and manage notification messages

### 3. Kick Integration Data
- Kick usernames/channel names and broadcaster IDs that you choose to follow
- Public Kick stream information (stream title, viewer count, etc.)
- Stream status (online/offline) for notification purposes
- Stream and VOD metadata used to display and manage notification messages

### 4. Multistream Configuration Data
- Links between Twitch and Kick stream subscriptions for the same creator
- Platform priority (Twitch or Kick) and late-merge settings for unified notifications

### 5. Stream Notification Message Data
- Stored notification messages (Discord channel and message IDs) for live/offline alerts
- Cached stream and streamer data (e.g., title, thumbnail, URL) used when posting or updating notifications

### 6. Emote Data
- Temporary storage of emote images during upload process
- Emote names and source information (Discord server or 7TV)
- Processing metadata required for emote conversion and optimization

### 7. Optional: Weather and Location Data
- When you use the weather command, the location string you provide may be sent to geocoding and weather APIs (e.g., OpenStreetMap Nominatim, Open-Meteo) to fetch weather. Coordinates and results may be cached temporarily to improve performance. We do not use location data for purposes other than fulfilling the weather request.

### 8. Usage Data
- Command usage statistics (anonymized, e.g., command names and counts per server)
- Bot performance metrics
- Error logs for troubleshooting (temporarily stored)
- Feature usage patterns to improve service quality

## How We Use Your Information

The information we collect is used exclusively for:

1. **Core Functionality**: Providing Twitch and Kick stream notifications, multistream merging, clip updates, emote management, games, and utility commands (e.g., weather, time, timestamps)
2. **Service Improvement**: Enhancing the Bot based on usage patterns
3. **Technical Maintenance**: Ensuring the Bot operates correctly and efficiently

Your data is never:
- Sold to third parties
- Used for advertising
- Shared with external entities except as required for the Bot's functionality

### Examples of Data Usage

- When you subscribe to a Twitch or Kick streamer, we store their name and broadcaster ID, your Discord channel ID, role ID (if set), and custom message templates to deliver notifications when they go live or offline
- When you link Twitch and Kick streams for multistream support, we store the link and your priority/late-merge settings to send a single merged notification
- When you request emote uploads, we temporarily process the emote data to facilitate adding it to your Discord server
- When you configure clip notifications, we periodically check for new Twitch clips and use your channel settings to post hourly updates
- When you use the weather command, we use your provided location to fetch and display weather via third-party APIs; location data is not used for any other purpose

## Data Storage and Security

We store your data using Cloudflare services (e.g., D1 database, KV) with appropriate security measures. Data is retained only as long as necessary for providing the Bot's services. If you remove the Bot from your server, your server-specific data will be automatically deleted after 30 days.

### Data Retention Periods

- **Active Data**: Data actively used for bot functionality (streams, clips, multistream links, notification messages) is retained as long as you use the service
- **Command Logs**: Usage statistics (e.g., via Cloudflare Analytics Engine) are retained for up to 90 days
- **Error Logs**: Technical error information is retained for up to 14 days
- **Temporary Processing Data**: Data used for temporary operations (such as emote processing) is deleted immediately after use
- **Cache Data**: Cached data (e.g., weather, geocoding) is stored with short expiration times (e.g., one hour to one day) and then removed
- **Removed Server Data**: Data for servers that remove the bot is deleted after 30 days

## Cross-Border Data Transfers

DinkDonk Bot operates using Cloudflare Workers, which may process data in various global locations. Your data may be transferred to and processed in countries other than your country of residence. By using the Bot, you consent to these international transfers. We ensure that appropriate safeguards are in place to protect your data regardless of location.

## Data Sharing

DinkDonk Bot interfaces with the following third-party services:
- **Discord API**: To provide bot functionality within Discord
- **Twitch API**: To retrieve stream, clip, and VOD information
- **Kick API**: To retrieve Kick stream and VOD information
- **7TV API**: For emote integration features
- **OpenStreetMap Nominatim**: For geocoding when you use the weather command (location strings only)
- **Open-Meteo**: For weather data when you use the weather command

Information is shared with these services only as necessary for the Bot to function properly.

## Your Rights

You have the right to:
- Remove the Bot from your server at any time
- Request deletion of your server's data by contacting us
- Ask what data we store about your server
- Request correction of inaccurate data
- Object to certain processing of your data
- Request a copy of your data in a structured, commonly used format

### GDPR and CCPA Compliance

For users in the European Economic Area (EEA), United Kingdom, or California, you have additional rights under the General Data Protection Regulation (GDPR) or California Consumer Privacy Act (CCPA):

- **Right to be informed**: This Privacy Policy provides detailed information about how we process your data
- **Right of access**: You can request access to all personal data we hold about you
- **Right to erasure**: You can request deletion of your personal data (subject to certain exceptions)
- **Right to restriction of processing**: You can request that we limit how we use your data
- **Right to data portability**: You can request a copy of your data in a machine-readable format
- **Right to object**: You can object to our processing of your data in certain circumstances
- **Rights related to automated decision making**: We do not make automated decisions that significantly affect you

To exercise any of these rights, please contact us through the methods listed in the Contact Information section.

## Children's Privacy

The Bot is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected data from a child under 13, please contact us immediately.

## Changes to This Policy

We may update this Privacy Policy from time to time. We will notify users of any significant changes by posting the new Privacy Policy in our documentation and/or through the Bot's announcement features.

## Contact Information

If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
- GitHub Issues: [https://github.com/svglol/dinkdonkbot/issues](https://github.com/svglol/dinkdonkbot/issues)

## Legal Basis for Processing

We process your data based on:
- **Legitimate Interest**: To provide the Bot services you request
- **Consent**: When you choose to use optional features
- **Contractual Necessity**: To fulfill our obligations under our Terms of Service

You can withdraw consent at any time by removing the Bot from your server or disabling specific features.