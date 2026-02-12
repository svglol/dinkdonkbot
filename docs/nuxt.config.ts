export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],
  site: {
    url: 'https://svglol.github.io/dinkdonkbot',
    name: 'DinkDonk Bot',
  },
  app: {
    baseURL: '/dinkdonkbot',
  },
  ui: {
    theme: {
      colors: [
        'primary',
        'secondary',
        'tertiary',
        'info',
        'success',
        'warning',
        'error',
      ],
    },
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: [
        '/_ipx/_/kick.webp',
        '/_ipx/_/twitch.webp',
      ],
    },
  },
})
