import type { APIEmbed } from 'discord-api-types/v10'
import type { Birthday, BirthdayConfigWithBirthdays } from '@/database/db'
import { toZonedTime } from 'date-fns-tz'
import tzlookup from 'tz-lookup'
import { eq, tables, useDB } from '@/database/db'
import { fetchGuild, findBotCommandMarkdown, isUserInGuild, removeRole, sendMessage, setRole, updateMessage } from '@/discord/discord'
import { ordinal } from '@/utils/dates'
import { getGeoData } from '@/utils/geoData'

export async function scheduledBirthdayCheck(env: Env) {
  const birthdayConfigs = await useDB(env).query.birthdayConfig.findMany({
    where: (config, { eq }) => eq(config.disabled, false),
    with: { birthdays: { where: (b, { eq }) => eq(b.disabled, false) } },
  })

  for (const birthdayConfig of birthdayConfigs) {
    const todaysBirthdays: Birthday[] = []
    for (const birthday of birthdayConfig.birthdays) {
      if (!birthday.announcedAt) {
        // check if it is the users birthday
        const timezone = birthday.timezone || birthdayConfig.timezone || 'UTC'
        const nowInTimezone = toZonedTime(new Date(), timezone)
        const isBirthday = nowInTimezone.getDate() === birthday.day && (nowInTimezone.getMonth() + 1) === birthday.month
        if (isBirthday) {
          // check if the user is still in the server
          const userInGuild = await isUserInGuild(birthdayConfig.guildId, birthday.userId, env)
          if (!userInGuild || !birthdayConfig.announcementChannelId) {
            if (!userInGuild) {
              // if the user has left the server we disable their birthday so it doesnt keep trying to announce every year
              await useDB(env).update(tables.birthday).set({ disabled: true }).where(eq(tables.birthday.id, birthday.id))
            }
            continue
          }

          todaysBirthdays.push(birthday)
        }
      }
      else {
        if (new Date().getTime() - new Date(birthday.announcedAt!).getTime() > 24 * 60 * 60 * 1000) {
          // birthday is over
          if (birthdayConfig.birthdayRoleId) {
            await removeRole(birthdayConfig.guildId, birthday.userId, birthdayConfig.birthdayRoleId, env)
          }
          await useDB(env).update(tables.birthday).set({ announcedAt: null }).where(eq(tables.birthday.id, birthday.id))
        }
      }
    }

    // build the message to send to the server
    if (todaysBirthdays.length > 0) {
      const message = await sendMessage(birthdayConfig.announcementChannelId!, await buildAnnouncementMessage(todaysBirthdays, env), env)
      if (message) {
        if (birthdayConfig.birthdayRoleId) {
        // add the birthday role to the user
          for (const birthday of todaysBirthdays) {
            await setRole(birthdayConfig.guildId, birthday.userId, birthdayConfig.birthdayRoleId, env)
          }
        }

        // update the announcedAt field for this birthday to the current date so we dont announce it again for this user until next year
        for (const birthday of todaysBirthdays) {
          await useDB(env).update(tables.birthday).set({ announcedAt: new Date() }).where(eq(tables.birthday.id, birthday.id))
        }
      }
    }
  }
}

export async function buildAnnouncementMessage(birthdays: Birthday[], env: Env) {
  const descriptions = birthdays.map((birthday) => {
    return `<@${birthday.userId}>${birthday.year ? ` (turning ${new Date().getFullYear() - birthday.year})` : ''}`
  })

  const description = birthdays.length === 1
    ? `Today is <@${birthdays[0].userId}>'s birthday! Wish them a happy birthday!${birthdays[0].year ? `\nThey are turning ${new Date().getFullYear() - birthdays[0].year} years old!` : ''}`
    : `Today is ${descriptions.slice(0, -1).join(', ')} and ${descriptions.at(-1)}'s birthday! Wish them a happy birthday!`

  const embed = {
    title: `🎉 Happy Birthday!`,
    description,
    color: 0xFF69B4,
    thumbnail: {
      url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/birthday.gif` : '',
    },
    timestamp: new Date().toISOString(),
    footer: {
      text: 'DinkDonk Bot',
      icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
  } satisfies APIEmbed

  return { embeds: [embed] }
}

export async function scheduledBirthdayOverviewUpdate(env: Env) {
  const birthdayConfigs = await useDB(env).query.birthdayConfig.findMany({
    where: (config, { eq }) => eq(config.disabled, false),
    with: { birthdays: { where: (b, { eq }) => eq(b.disabled, false) } },
  })
  for (const birthdayConfig of birthdayConfigs) {
    // check if the bot is still in the server
    const guild = await fetchGuild(birthdayConfig.guildId, env)
    if (!guild) {
      await useDB(env).update(tables.birthdayConfig).set({ disabled: true }).where(eq(tables.birthdayConfig.guildId, birthdayConfig.guildId))
      continue
    }

    // check if any of the users have left the server
    for (const birthday of birthdayConfig.birthdays) {
      const userInGuild = await isUserInGuild(birthdayConfig.guildId, birthday.userId, env)
      if (!userInGuild) {
        await useDB(env).update(tables.birthday).set({ disabled: true }).where(eq(tables.birthday.id, birthday.id))
        birthdayConfig.birthdays = birthdayConfig.birthdays.filter(b => b.id !== birthday.id)
      }
    }

    if (birthdayConfig.overviewChannelId)
      await birthdayOverviewUpdate(birthdayConfig.guildId, env)
  }
}

export async function birthdayOverviewUpdate(guildId: string, env: Env) {
  const birthdayConfig = await useDB(env).query.birthdayConfig.findFirst({
    where: (config, { eq }) => eq(config.guildId, guildId),
    with: { birthdays: { where: (b, { eq }) => eq(b.disabled, false) } },
  })

  if (!birthdayConfig || !birthdayConfig.overviewChannelId)
    return null

  const birthdayOverviewEmbed = await buildBirthdayOverviewMessage(guildId, birthdayConfig, env)
  let messageId = birthdayConfig.overviewMessageId

  if (!birthdayConfig.overviewMessageId) {
    // Send a new message to the overview channel
    const newMessage = await sendMessage(birthdayConfig.overviewChannelId, { embeds: [birthdayOverviewEmbed] }, env)
    if (newMessage)
      messageId = newMessage
  }
  else {
    // Update the existing overview message
    const newMessage = await updateMessage(birthdayConfig.overviewChannelId, birthdayConfig.overviewMessageId, env, { embeds: [birthdayOverviewEmbed] })
    // if we cant update the message - create a new one
    if (!newMessage) {
      const newMessage = await sendMessage(birthdayConfig.overviewChannelId, { embeds: [birthdayOverviewEmbed] }, env)
      if (newMessage)
        messageId = newMessage
    }
  }

  return messageId
}

async function buildBirthdayOverviewMessage(guildId: string, birthdayConfig: BirthdayConfigWithBirthdays, env: Env) {
  const guild = await fetchGuild(guildId, env)
  const header = `Register your birthday with the ${await findBotCommandMarkdown(env, 'birthdays', 'register')} command!\n`

  // if the birthday config is disabled we show a different message prompting the user to enable it instead of showing the birthday overview
  if (birthdayConfig.disabled) {
    return {
      color: 0xFF4444,
      title: `🎂 Birthday List - ${guild?.name}`,
      thumbnail: {
        url: guild?.icon ? `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png` : env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
      },
      description: `${header}\n⚠️ Birthday announcements are currently disabled for this server.`,
      footer: {
        text: 'DinkDonk Bot',
        icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
      },
      timestamp: new Date().toISOString(),
    } satisfies APIEmbed
  }

  const description = birthdayConfig?.birthdays.length === 0
    ? `${header}\nNo birthdays registered yet. 😢`
    : await buildDescription(header, birthdayConfig!, env)

  return {
    color: 0xFFF200,
    title: `🎂 Birthday List - ${guild?.name}`,
    thumbnail: {
      url: guild?.icon ? `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.png` : env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
    description,
    footer: {
      text: `DinkDonk Bot • Server Timezone (${birthdayConfig.timezone})`,
      icon_url: env.WEBHOOK_URL ? `${env.WEBHOOK_URL}/static/dinkdonk.png` : '',
    },
    timestamp: new Date().toISOString(),
  } satisfies APIEmbed
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

async function buildDescription(header: string, birthdayConfig: BirthdayConfigWithBirthdays, env: Env) {
  const TRUNCATION_SUFFIX = async (count: number) => `\n\n*...and ${count} more birthday${count === 1 ? '' : 's'}. Use ${await findBotCommandMarkdown(env, 'birthdays', 'list')} to see all.*`

  const grouped = MONTHS.reduce((acc, month, i) => {
    const monthBirthdays = birthdayConfig.birthdays
      .filter(b => b.month === i + 1)
      .sort((a, b) => a.day - b.day)
    if (monthBirthdays.length > 0)
      acc.push({ month, birthdays: monthBirthdays })
    return acc
  }, [] as { month: string, birthdays: Birthday[] }[])

  const lines = grouped.flatMap(({ month, birthdays }) => [
    `\n**${month}**`,
    ...birthdays.map((b) => {
      return `<@${b.userId}> - ${ordinal(b.day)} ${MONTHS[b.month - 1]}`
    }),
  ])

  let description = header
  for (let i = 0; i < lines.length; i++) {
    const remaining = lines.length - (i + 1)
    const potentialSuffix = remaining > 0 ? await TRUNCATION_SUFFIX(remaining) : ''

    if ((`${description + lines[i]}\n${potentialSuffix}`).length > 4096) {
      return description + await TRUNCATION_SUFFIX(lines.length - i)
    }
    description += `${lines[i]}\n`
  }

  return description
}

export async function getTimezoneFromQuery(rawQuery: string, env: Env) {
  const query = String(rawQuery).toLowerCase().replace(/\s+/g, '_')
  const matches = Intl.supportedValuesOf('timeZone')
    .filter(tz => tz.toLowerCase().replace(/^[^/]+\//, '').includes(query))
    .slice(0, 25)
    .map(tz => ({ name: tz, value: tz }))

  // lookup location from the query as well
  try {
    const geoData = await getGeoData(rawQuery, env)
    const tzMatch = tzlookup(geoData[0].lat, geoData[0].lon)
    if (tzMatch && !matches.some(m => m.value === tzMatch)) {
      matches.unshift({ name: tzMatch, value: tzMatch })
    }
  }
  catch {
  // geodata lookup failed, continue with existing matches
  }
  return matches
}

export function validateTimezone(timezone: string) {
  return Intl.supportedValuesOf('timeZone').includes(timezone)
}
