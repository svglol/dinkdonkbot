// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  future: {
    compatibilityVersion: 4,
  },
  typescript: {
    typeCheck: true,
    strict: true,
  },
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@vueuse/nuxt',
    '@nuxt/content',
    'nuxt-og-image',
  ],
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error'],
    },
  },
  css: ['~/assets/css/main.css'],
  imports: {
    autoImport: true,
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },
  experimental: {
    typedPages: true,
  },
  site: {
    url: 'https://svglol.github.io/dinkdonkbot',
    name: 'DinkDonk Bot',
  },

  ogImage: {
    componentOptions: {
      global: true,
    },
  },
  app: {
    baseURL: '/dinkdonkbot',
  },
})
