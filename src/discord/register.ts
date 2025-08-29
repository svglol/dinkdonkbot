/* eslint-disable antfu/no-top-level-await */
/* eslint-disable no-console */
import process from 'node:process'
import dotenv from 'dotenv'
import { ADMIN_COMMAND_DEFINITIONS } from './adminCommands' // new admin commands
import { COMMAND_DEFINITIONS } from './commands'

dotenv.config({ path: '.dev.vars' })

const token = process.env.DISCORD_TOKEN
const applicationId = process.env
const adminGuildId = process.env.DISCORD_GUILD_ID // admin server ID

if (!token)
  throw new Error('The DISCORD_TOKEN environment variable is required.')

if (!applicationId) {
  throw new Error(
    'The DISCORD_APPLICATION_ID environment variable is required.',
  )
}

if (!adminGuildId)
  throw new Error('The DISCORD_GUILD_ID environment variable is required.')

/**
 * Register all commands globally.
 */
const url = `https://discord.com/api/v10/applications/${applicationId}/commands`

const response = await fetch(url, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bot ${token}`,
  },
  method: 'PUT',
  body: JSON.stringify(COMMAND_DEFINITIONS),
})

if (response.ok) {
  console.log('Registered all global commands')
  const data = await response.json()
  console.log(JSON.stringify(data, null, 2))
}
else {
  console.error('Error registering global commands')
  let errorText = `Error registering commands \n ${response.url}: ${response.status} ${response.statusText}`
  try {
    const error = await response.text()
    if (error)
      errorText = `${errorText} \n\n ${error}`
  }
  catch (err) {
    console.error('Error reading body from request:', err)
  }
  console.error(errorText)
}

/**
 * Register admin-only commands for the admin server.
 */
const adminUrl = `https://discord.com/api/v10/applications/${applicationId}/guilds/${adminGuildId}/commands`

const adminResponse = await fetch(adminUrl, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bot ${token}`,
  },
  method: 'PUT',
  body: JSON.stringify(ADMIN_COMMAND_DEFINITIONS),
})

if (adminResponse.ok) {
  console.log('Registered all admin commands for guild', adminGuildId)
  const data = await adminResponse.json()
  console.log(JSON.stringify(data, null, 2))
}
else {
  console.error('Error registering admin commands')
  let errorText = `Error registering admin commands \n ${adminResponse.url}: ${adminResponse.status} ${adminResponse.statusText}`
  try {
    const error = await adminResponse.text()
    if (error)
      errorText = `${errorText} \n\n ${error}`
  }
  catch (err) {
    console.error('Error reading body from request:', err)
  }
  console.error(errorText)
}
