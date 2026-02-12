<template>
  <div
    class="flex flex-col items-center gap-8"
  >
    <div class="flex w-full max-w-2xl flex-col items-center gap-2">
      <client-only>
        <DiscordMessages
          :key="isDark"
          :light-theme="!isDark"
          class="w-full rounded-md shadow-lg shadow-yellow-500/20"
          :edited="messageType === 'offline'"
        >
          <DiscordMessage profile="bot">
            <template v-if="messageType === 'live'">
              <DiscordMention type="role">
                everyone
              </DiscordMention>
              &nbsp;
              {{ streamer.name }}
              is now live @

              <template v-if="platform === 'multistream'">
                <a :href="`https://twitch.tv/${streamer.handle}`">https://twitch.tv/{{ streamer.handle }}</a>
                &
                <a :href="`https://kick.com/${streamer.handle}`">https://kick.com/{{ streamer.handle }}</a>
              </template>
              <template v-else-if="platform === 'twitch'">
                <a :href="`https://twitch.tv/${streamer.handle}`">https://twitch.tv/{{ streamer.handle }}</a>
              </template>
              <template v-else-if="platform === 'kick'">
                <a :href="`https://kick.com/${streamer.handle}`">https://kick.com/{{ streamer.handle }}</a>
              </template>
            </template>
            <template v-else>
              {{ streamer.name }} is now offline.
            </template>

            <template #embeds>
              <DiscordEmbed
                :border-color="getBorderColor(platform)"
                :thumbnail="streamer.profile"
                :image="messageType === 'live' ? streamer.preview : streamer.offlineImg"
                :embed-title="streamer.title"
                :url="platform === 'kick' ? `https://kick.com/${streamer.handle}` : `https://twitch.tv/${streamer.handle}`"
                footer-icon="/dinkDonk-512.png"
              >
                <b>
                  <template v-if="platform === 'multistream'">
                    <NuxtImg src="/twitch.webp" class="inline size-5" />
                    <NuxtImg src="/kick.webp" class="inline size-5" />
                    <template v-if="messageType === 'live'">
                      {{ streamer.name }} is live on Twitch &amp; KICK!
                    </template>
                    <template v-else>
                      {{ streamer.name }} is no longer live on Twitch &amp; KICK!
                    </template>
                  </template>
                  <template v-else-if="platform === 'twitch'">
                    <NuxtImg src="/twitch.webp" class="inline size-5" />
                    <template v-if="messageType === 'live'">
                      {{ streamer.name }} is live on Twitch!
                    </template>
                    <template v-else>
                      {{ streamer.name }} is no longer live on Twitch!
                    </template>
                  </template>
                  <template v-else-if="platform === 'kick'">
                    <NuxtImg src="/kick.webp" class="inline size-5" />
                    <template v-if="messageType === 'live'">
                      {{ streamer.name }} is live on KICK!
                    </template>
                    <template v-else>
                      {{ streamer.name }} is no longer live on KICK!
                    </template>
                  </template>
                </b>

                <template #footer>
                  {{ messageType === 'live' ? 'Online' : 'Last Online' }} • Today at
                  {{ new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                </template>

                <template #fields>
                  <DiscordEmbedFields>
                    <template v-if="messageType === 'live'">
                      <DiscordEmbedField field-title="Category">
                        {{ category }}
                      </DiscordEmbedField>
                    </template>
                    <template v-else>
                      <DiscordEmbedField field-title="Streamed For">
                        {{ Math.floor(Math.random() * 4) + 1 }}h {{ Math.floor(Math.random() * 60) }}m {{ Math.floor(Math.random() * 60) }}s
                      </DiscordEmbedField>
                    </template>
                  </DiscordEmbedFields>
                </template>
              </DiscordEmbed>

              <DiscordButtons>
                <DiscordButton
                  v-if="platform !== 'kick'"
                  type="link"
                  :url="`https://twitch.tv/${streamer.handle}`"
                >
                  <NuxtImg src="/twitch.webp" class="mr-1 inline size-5" />
                  <template v-if="messageType === 'live'">
                    Watch on Twitch
                  </template>
                  <template v-else>
                    Watch Twitch VOD
                  </template>
                </DiscordButton>
                <DiscordButton
                  v-if="platform !== 'twitch'"
                  type="link"
                  :url="`https://kick.com/${streamer.handle}`"
                >
                  <NuxtImg src="/kick.webp" class="mr-1 inline size-5" />
                  <template v-if="messageType === 'live'">
                    Watch on KICK
                  </template>
                  <template v-else>
                    Watch KICK VOD
                  </template>
                </DiscordButton>
              </DiscordButtons>
            </template>
          </DiscordMessage>
        </DiscordMessages>
        <template #fallback>
          <div
            class="
              flex h-145 w-full rounded-md border border-gray-50/5 bg-[#36393e]
              text-white shadow-lg shadow-yellow-500/20
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
      <span class="text-sm text-neutral-400">This message is just a preview, actual messages may look slightly different.</span>
    </div>
    <div class="flex flex-wrap justify-center gap-4">
      <UFieldGroup size="xl">
        <UButton
          size="xl"
          color="secondary"
          :variant="platform === 'twitch' ? 'solid' : 'soft'"
          icon="i-simple-icons-twitch"
          @click="platform = 'twitch'"
        >
          Twitch
        </UButton>
        <UButton
          size="xl"
          color="tertiary"
          :variant="platform === 'kick' ? 'solid' : 'soft'"
          icon="i-simple-icons-kick"
          @click="platform = 'kick'"
        >
          Kick
        </UButton>
        <UButton
          size="xl"
          color="primary"
          :variant="platform === 'multistream' ? 'solid' : 'soft'"
          icon="i-lucide-link"
          @click="platform = 'multistream'"
        >
          Multistream
        </UButton>
      </UFieldGroup>
      <UFieldGroup size="xl">
        <UButton
          size="xl"
          color="neutral"
          :variant="messageType === 'live' ? 'solid' : 'soft'"
          icon="i-lucide-wifi"
          @click="messageType = 'live'"
        >
          Live
        </UButton>
        <UButton
          size="xl"
          color="neutral"
          :variant="messageType === 'offline' ? 'solid' : 'soft'"
          icon="i-lucide-wifi-off"
          @click="messageType = 'offline'"
        >
          Offline
        </UButton>
      </UFieldGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
type Platform = 'twitch' | 'kick' | 'multistream'

const platform = ref<Platform>('multistream')
const messageType = ref<'live' | 'offline'>('live')

const streamers = [
  {
    name: 'TheBurntPeanut',
    handle: 'theburntpeanut',
    title: 'NUT RAIDERS | 1 MILLION SPACE DOLLAR CHALLENGE | FROM DUMB AND POOR TO RICH AND SEXY | #BUNGULATE',
    profile: '/streamers/theburntpeanut.png',
    preview: '/streamers/theburntpeanut-preview.jpg',
    offlineImg: '/streamers/theburntpeanut-offline.jpg',
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

const streamer = streamers[Math.floor(Math.random() * streamers.length)]
const category = categories[Math.floor(Math.random() * categories.length)]

const COLORS = {
  TWITCH: '#6441A4',
  KICK: '#53FC18',
  MULTI: '#FFF200',
  OFFLINE: '#747F8D',
}

function getBorderColor(p: Platform) {
  if (messageType.value === 'offline') {
    return COLORS.OFFLINE
  }
  const colorMap: Record<Platform, string> = {
    twitch: COLORS.TWITCH,
    kick: COLORS.KICK,
    multistream: COLORS.MULTI,
  }
  return colorMap[p] || COLORS.OFFLINE
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
