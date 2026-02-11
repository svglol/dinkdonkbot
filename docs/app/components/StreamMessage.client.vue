<template>
  <div>
    <DiscordMessages
      :key="isDark"
      :light-theme="!isDark"
      class="rounded-md"
    >
      <DiscordMessage
        profile="bot"
      >
        <DiscordMention type="role">
          everyone
        </DiscordMention> {{ streamer.name }} is now live @

        <template v-if="variant === 'multistream'">
          <a href="https://twitch.tv/{{ streamer.handle }}">https://twitch.tv/{{ streamer.handle }}</a> &
          <a href="https://kick.com/{{ streamer.handle }}">https://kick.com/{{ streamer.handle }}</a>
        </template>
        <template v-else-if="variant === 'twitch'">
          <a href="https://twitch.tv/{{ streamer.handle }}">https://twitch.tv/{{ streamer.handle }}</a>
        </template>
        <template v-else-if="variant === 'kick'">
          <a href="https://kick.com/{{ streamer.handle }}">https://kick.com/{{ streamer.handle }}</a>
        </template>

        <template #embeds>
          <DiscordEmbed
            :border-color="getBorderColor(variant)"
            :thumbnail="streamer.NuxtImg "
            :image="streamer.preview"
            :embed-title="streamer.title"
            :url="variant === 'kick' ? `https://kick.com/${streamer.handle}` : `https://twitch.tv/${streamer.handle}` "
            footer-icon="/dinkDonk-512.png"
          >
            <b>
              <template v-if="variant === 'multistream'">
                <NuxtImg src="/twitch.webp" class="inline size-5" />
                <NuxtImg src="/kick.webp" class="inline size-5" />
                {{ streamer.name }} is live on Twitch & KICK!</template>
              <template v-else-if="variant === 'twitch'">
                <NuxtImg src="/twitch.webp" class="inline size-5" />
                {{ streamer.name }} is live on Twitch!</template>
              <template v-else-if="variant === 'kick'">
                <NuxtImg src="/kick.webp" class="inline size-5" />
                {{ streamer.name }} is live on KICK!</template>
            </b>

            <template #footer>
              Online • Today at {{ new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
            </template>

            <template #fields>
              <DiscordEmbedFields>
                <DiscordEmbedField field-title="Category">
                  {{ category }}
                </DiscordEmbedField>
              </DiscordEmbedFields>
            </template>
          </DiscordEmbed>
          <DiscordButtons>
            <DiscordButton v-if="variant !== 'kick'" type="link" :url="`https://twitch.tv/${streamer.handle}`">
              <NuxtImg src="/twitch.webp" class="mr-1 inline size-5" />
              Watch on Twitch
            </DiscordButton>
            <DiscordButton v-if="variant !== 'twitch'" type="link" :url="`https://kick.com/${streamer.handle}`">
              <NuxtImg src="/kick.webp" class="mr-1 inline size-5" />
              Watch on Kick
            </DiscordButton>
          </DiscordButtons>
        </template>
      </DiscordMessage>
    </DiscordMessages>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  variant: 'twitch' | 'kick' | 'multistream'
}>()

const streamers = [
  {
    name: 'TheBurntPeanut',
    handle: 'theburntpeanut',
    title: 'NUT RAIDERS | 1 MILLION SPACE DOLLAR CHALLENGE | FROM DUMB AND POOR TO RICH AND SEXY | #BUNGULATE',
    NuxtImg: '/streamers/theburntpeanut.png',
    preview: '/streamers/theburntpeanut-preview.jpg',
  },
]

const categories = [
  'Just Chatting',
  'Valorant',
  'Call of Duty: Warzone',
  'Minecraft',
  'Among Us',
  'Escape from Tarkov',
  'Grand Theft Auto V',
  'Apex Legends',
  'Arc Raiders',
]

const streamer = streamers[
  Math.floor(Math.random() * streamers.length)
]

const category = categories[
  Math.floor(Math.random() * categories.length)
]

const COLORS = {
  TWITCH: '#6441A4',
  KICK: '#53FC18',
  MULTI: '#FFF200',
  OFFLINE: '#747F8D',
}

function getBorderColor(variant: 'twitch' | 'kick' | 'multistream') {
  const colorMap = {
    twitch: COLORS.TWITCH,
    kick: COLORS.KICK,
    multistream: COLORS.MULTI,
  }
  return colorMap[variant] || COLORS.OFFLINE
}

const colorMode = useColorMode()

const isDark = computed({
  get() {
    return colorMode.value === 'dark'
  },
  set(_isDark) {
    colorMode.preference = _isDark ? 'dark' : 'light'
  },
})
</script>
