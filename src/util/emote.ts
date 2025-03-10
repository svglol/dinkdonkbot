import { Buffer } from 'node:buffer'

/**
 * Fetches the image at the specified URL and returns it as a Buffer.
 *
 * @param url - The URL of the image to fetch.
 * @returns A Buffer containing the image data.
 * @throws If the image could not be fetched.
 */
export async function fetchEmoteImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)

  if (!response.ok)
    throw new Error(`Failed to fetch emote from discord: ${response.status}`)

  const arrayBuffer = await response.arrayBuffer()

  return Buffer.from(arrayBuffer)
}

/**
 * Fetches a singular emote from 7tv using the provided emote ID.
 *
 * Sends a GraphQL request to the 7tv API to retrieve details about the emote,
 * including its name, ID, and animation status. Constructs the URL for the
 * emote's image based on the retrieved data.
 *
 * @param emoteId - The unique identifier for the emote to fetch.
 * @returns An object containing the emote's name, ID, animation status, and image URL,
 * or null if the emote could not be fetched.
 * @throws Will throw an error if the emote ID is empty or if the fetch request fails.
 */

export async function fetchSingular7tvEmote(emoteId: string) {
  if (!emoteId) {
    throw new Error('Empty emote ID provided')
  }

  const headers = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'Referer': 'https://7tv.app/',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }

  const data = {
    operationName: 'Emote',
    variables: {
      id: emoteId,
    },
    query:
        'query Emote($id: ObjectID!) {\n  emote(id: $id) {\n    id\n    created_at\n    name\n    lifecycle\n    state\n    trending\n    tags\n    owner {\n      id\n      username\n      display_name\n      avatar_url\n      style {\n        color\n        paint_id\n        __typename\n      }\n      __typename\n    }\n    flags\n    host {\n      ...HostFragment\n      __typename\n    }\n    versions {\n      id\n      name\n      description\n      created_at\n      lifecycle\n      state\n      host {\n        ...HostFragment\n        __typename\n      }\n      __typename\n    }\n    animated\n    __typename\n  }\n}\n\nfragment HostFragment on ImageHost {\n  url\n  files {\n    name\n    format\n    width\n    height\n    size\n    __typename\n  }\n  __typename\n}',
  }

  const response = await fetch('https://7tv.io/v3/gql', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch emote: ${response.status}`)
  }

  const responseData = await response.json() as { data: { emote: { name: string, id: string, animated: boolean } } }
  if (!responseData.data) {
    throw new Error('Failed to fetch emote from 7tv')
  }
  const { name, id, animated } = responseData.data.emote

  return {
    name,
    id,
    animated,
    url: `https://cdn.7tv.app/emote/${id}/`,
  }
}

/**
 * Downloads an emote from the 7tv CDN and returns the image buffer, or an object with an error string.
 * @param emote - The emote object from fetchSingular7tvEmote, containing the name, id, animated status, and url.
 * @param emote.name - The name of the emote.
 * @param emote.id - The ID of the emote.
 * @param emote.animated - A boolean indicating whether the emote is animated.
 * @param emote.url - The URL of the emote image.
 * @returns The image buffer
 */
export async function fetch7tvEmoteImageBuffer(emote: { name: string, id: string, animated: boolean, url: string }): Promise<Buffer> {
  const sizes = ['4x', '3x', '2x', '1x']
  const extension = emote.animated ? 'gif' : 'png'

  for (const size of sizes) {
    const url = `${emote.url}${size}.${extension}`

    try {
      const response = await fetch(url)

      if (!response.ok) {
        continue
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const MAX_DISCORD_EMOJI_SIZE = 256 * 1024
      if (buffer.byteLength <= MAX_DISCORD_EMOJI_SIZE) {
        return buffer
      }

      continue
    }
    catch (error) {
      console.error(`Failed to download ${emote.name} at size ${size}: ${error}`)
      continue
    }
  }

  throw new Error(`Emote is too large to upload to Discord`)
}
