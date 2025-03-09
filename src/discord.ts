export async function sendMessage(channelId: string, discordToken: string, body: DiscordBody) {
  const url = `https://discord.com/api/channels/${channelId}/messages`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${discordToken}`,
      },
      body: JSON.stringify(body),
    })

    // If rate limited, wait and retry
    if (response.status === 429) {
      const rateLimitData = await response.json() as { retry_after: number }
      await new Promise(resolve => setTimeout(resolve, rateLimitData.retry_after * 1000 + 100))
      return sendMessage(channelId, discordToken, body)
    }

    if (!response.ok) {
      throw new Error(`Failed to send message: ${await response.text()}`)
    }

    const data = await response.json() as { id: string }
    return data.id
  }
  catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

export async function updateMessage(channelId: string, messageId: string, discordToken: string, body: DiscordBody) {
  const url = `https://discord.com/api/channels/${channelId}/messages/${messageId}`

  try {
    const message = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${discordToken}`,
      },
      body: JSON.stringify(body),
    })
    if (!message.ok)
      throw new Error(`Failed to update message: ${await message.text()}`)

    const data = await message.json() as { id: string }
    return data.id
  }
  catch (error) {
    console.error('Error sending message:', error)
  }
}

export async function updateInteraction(interaction: DiscordInteraction, dicordApplicationId: string, body: DiscordBody) {
  try {
    const defer = await fetch(`https://discord.com/api/v10/webhooks/${dicordApplicationId}/${interaction.token}/messages/@original`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!defer.ok)
      throw new Error(`Failed to update interaction: ${await defer.text()}`)
  }
  catch (error) {
    console.error('Error updating interaction:', error)
  }
}

// eslint-disable-next-line node/prefer-global/buffer
export async function uploadEmoji(guildId: string, discordToken: string, emojiName: string, imageBuffer: Buffer) {
  const url = `https://discord.com/api/guilds/${guildId}/emojis`

  const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${discordToken}`,
      },
      body: JSON.stringify({
        name: emojiName,
        image: base64Image,
      }),
    })

    if (!response.ok)
      throw new Error(`Failed to upload emoji: ${await response.text()}`)

    const data = await response.json() as { id: string }
    return data
  }
  catch (error) {
    console.error('Error uploading emoji:', error)
  }
}
