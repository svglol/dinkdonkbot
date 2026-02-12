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
        // root: 'bg-radial from-yellow-500/10 via-[15%] to-[50%] via-yellow-500/5 to-transparent blur',
        root: 'relative overflow-hidden before:absolute before:inset-0 before:-z-10 before:bg-radial before:from-yellow-500/10 before:via-[15%] before:via-yellow-500/5 before:to-[70%] before:to-transparent before:blur',
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
