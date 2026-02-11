export default defineAppConfig({
  ui: {
    colors: {
      primary: 'yellow',
      neutral: 'neutral',
      secondary: 'purple',
      tertiary: 'green',
    },
    pageHero: {
      slots: {
        root: 'bg-radial from-yellow-500/20 via-[15%] to-[70%] via-yellow-600/20 to-transparent',
      },
    },
  },
  header: {
    title: 'DinkDonk Bot',
    logo: {
      light: '/dinkDonk-512.png',
      dark: '/dinkDonk-512.png',
      alt: 'DinkDonk Bot Logo',
    },
  },
  socials: {
    kofi: 'https://ko-fi.com/svglol',
    discord: 'https://discord.gg/NuY7Tnrb6F',
  },
})
