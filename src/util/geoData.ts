/**
 * Fetches the geo data for a given location. If the location is not found,
 * this function will throw an error.
 * @param location The location to fetch the geo data for
 * @param env The environment variables to use
 * @returns A list of geo data objects, where each object contains the latitude,
 * longitude, name, full display name, and address details of the location. If
 * the location was not found, an empty list will be returned.
 * @throws If the location was not found
 */
export async function getGeoData(location: string, env: Env) {
  const cacheKey = `geo:${location.toLowerCase()}`
  const cached = await env.KV.get(cacheKey)
  let geoData: { lat: number, lon: number, name: string, display_name: string, address: { country_code: string } }[]

  if (cached) {
    geoData = JSON.parse(cached)
  }
  else {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&addressdetails=1&limit=1`,
      {
        headers: {
          'User-Agent': 'DinkDonk Bot (https://github.com/svglol/dinkdonkbot)',
        },
      },
    )
    geoData = await geoRes.json()
    if (!geoData.length)
      throw new Error('Location not found')
    await env.KV.put(cacheKey, JSON.stringify(geoData), { expirationTtl: 86400 }) // 1 day
  }
  return geoData
}
