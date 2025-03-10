<template>
  <div class="z-20 flex flex-row justify-end gap-4 p-4">
    <UButton
      icon="uil:github"
      color="black"
      variant="link"
      aria-label="Github"
      to="https://github.com/svglol/dinkdonkbot"
      target="_blank"
    />
    <UButton
      :icon="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'"
      color="black"
      variant="link"
      aria-label="Theme"
      @click="toggle"
    />
  </div>
</template>

<script setup lang="ts">
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
