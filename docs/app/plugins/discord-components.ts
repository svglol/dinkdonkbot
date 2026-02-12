import { install as DiscordMessageComponents } from '@pycord/discord-message-components-vue'
import * as DiscordComponents from '@pycord/discord-message-components-vue'
import '@pycord/discord-message-components-vue/dist/style.css'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(DiscordMessageComponents, {
    profiles: {
      bot: {
        author: 'DinkDonk Bot',
        avatar: usePublicAsset('dinkDonk-512.png'),
        roleColor: '#5865F2',
        bot: true,
      },
    },
  })

  // Register all components globally
  Object.entries(DiscordComponents).forEach(([name, component]) => {
    if (name !== 'install' && typeof component === 'object') {
      nuxtApp.vueApp.component(name, component)
    }
  })
})
