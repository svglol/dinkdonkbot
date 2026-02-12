<template>
  <div>
    <client-only>
      <DiscordMessages
        :key="isDark"
        :light-theme="!isDark"
        class="rounded-md"
      >
        <DiscordMessage
          profile="bot"
        >
          <DiscordMention :highlight="true">
            everyone
          </DiscordMention>{{ streamer.name }} is now live @

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
              :thumbnail="streamer.profile "
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
      <template #fallback>
        <div
          class="
            flex h-145 w-full rounded-md border border-gray-50/5 bg-[#36393e]
            text-white
          "
        >
          <div
            class="flex w-full flex-col gap-4 rounded-md p-4 shadow-lg"
          >
            <!-- Message Header -->
            <div class="flex items-start gap-3">
              <USkeleton class="size-10 shrink-0 rounded-full" />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <div class="flex items-center gap-2">
                  <USkeleton class="h-4 w-32" />
                  <USkeleton class="h-3 w-20" />
                </div>
                <USkeleton class="h-4 w-full max-w-md" />
              </div>
            </div>

            <!-- Embed -->
            <div
              class="
                ml-13 flex max-w-130 flex-col gap-2 rounded border-l-4
                border-gray-500 bg-[#2f3136] p-4
              "
            >
              <!-- Embed Header -->
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 space-y-2">
                  <USkeleton class="h-5 w-3/4" />
                  <USkeleton class="h-4 w-full" />
                  <USkeleton class="h-4 w-2/3" />
                </div>
                <USkeleton class="size-20 shrink-0 rounded-full" />
              </div>

              <!-- Embed Image -->
              <USkeleton class="mt-2 h-64 w-full rounded" />

              <!-- Embed Footer -->
              <div class="mt-2 flex items-center gap-2">
                <USkeleton class="size-5 rounded-full" />
                <USkeleton class="h-3 w-48" />
              </div>
            </div>
            <div class="mt-3 ml-13 flex gap-2">
              <USkeleton class="h-9 w-40 rounded" />
              <USkeleton class="h-9 w-40 rounded" />
            </div>
          </div>
        </div>
      </template>
    </client-only>
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
    profile: '/streamers/theburntpeanut.png',
    preview: '/streamers/theburntpeanut-preview.jpg',
  },
  {
    name: 'xQc',
    handle: 'xqc',
    title: '🍩LIVE🍩CLICK🍩HERE🍩DRAMA🍩NEWS🍩REACTS🍩CLIPS🍩VIDEOS🍩THINGS🍩LOCK IN🍩GAMES🍩COOL🍩PS TOMORROW ASWELL, COOL🍩',
    profile: '/streamers/xqc.jpg',
    preview: '/streamers/xqc-preview.jpg',
    offlineImg: '/streamers/xqc-offline.png',
  },
  {
    name: 'Pestily',
    handle: 'pestily',
    title: 'DUCK HUNT | LITTLE BIT OF PVE THEN OVER TO HARDCORE THEN RIP PACKS',
    profile: '/streamers/pestily.png',
    preview: '/streamers/pestily-preview.jpg',
    offlineImg: '/streamers/pestily-offline.png',
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
