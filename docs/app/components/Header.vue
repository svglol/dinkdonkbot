<template>
  <div
    class="z-20" :class="[isHomePage ? '' : `
      bg-neutral-200
      dark:bg-neutral-800
    `]"
  >
    <div :class="{ 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8': !isHomePage, 'p-4': isHomePage }">
      <div class="flex flex-row items-center justify-between p-4">
        <div v-if="!isHomePage">
          <NuxtLink
            to="/" class="
              flex items-center text-xl font-bold text-gray-800
              hover:text-gray-600
              dark:text-white dark:hover:text-gray-200
            "
          >
            <span class="mr-3">
              <img src="/DinkDonk.webp" alt="DinkDonk Bot Logo" class="size-8">
            </span>
            DinkDonk Bot
          </NuxtLink>
        </div>

        <!-- Right side buttons -->
        <div class="flex flex-row gap-4" :class="{ 'ml-auto': isHomePage }">
          <UButton
            icon="uil:github"
            color="neutral"
            variant="ghost"
            aria-label="Github"
            to="https://github.com/svglol/dinkdonkbot"
            target="_blank"
          />
          <UButton
            :icon="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'"
            color="neutral"
            variant="ghost"
            aria-label="Theme"
            @click="toggle"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Check if we're on the home page
const route = useRoute()
const isHomePage = computed(() => route.path === '/')

const mode = useColorMode()
const isDark = computed({
  get() {
    return mode.value === 'dark'
  },
  set() {
    mode.preference = mode.value === 'dark' ? 'light' : 'dark'
  },
})

const isAppearanceTransition
  = typeof document !== 'undefined'
    && typeof document.startViewTransition === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Credit to [@hooray](https://github.com/hooray)
 * @see https://github.com/vuejs/vitepress/pull/2347
 * @see https://github.com/nuxt/devtools/blob/main/packages/devtools-ui-kit/src/components/NDarkToggle.vue
 */
function toggle(event?: MouseEvent) {
  if (!isAppearanceTransition || !event) {
    isDark.value = !isDark.value
    return
  }

  const x = event.clientX
  const y = event.clientY
  const endRadius = Math.hypot(
    Math.max(x, innerWidth - x),
    Math.max(y, innerHeight - y),
  )
  const transition = document.startViewTransition(async () => {
    isDark.value = !isDark.value
    await nextTick()
  })

  transition.ready.then(() => {
    const clipPath = [
      `circle(0px at ${x}px ${y}px)`,
      `circle(${endRadius}px at ${x}px ${y}px)`,
    ]
    document.documentElement.animate(
      {
        clipPath: isDark.value ? [...clipPath].reverse() : clipPath,
      },
      {
        duration: 400,
        easing: 'ease-in',
        pseudoElement: isDark.value
          ? '::view-transition-old(root)'
          : '::view-transition-new(root)',
      },
    )
  })
}
</script>
