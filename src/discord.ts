export async function sendMessage(channelId: string, discordToken: string, body: DiscordBody) {
  const url = `https://discord.com/api/channels/${channelId}/messages`
  try {
    const message = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${discordToken}`,
      },
      body: JSON.stringify(body),
    })
    if (!message.ok)
      throw new Error(`Failed to send message: ${await message.text()}`)

    const data = await message.json() as { id: string }
    return data.id
  }
  catch (error) {
    console.error('Error sending message:', error)
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
