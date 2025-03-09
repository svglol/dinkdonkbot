<template>
  <div
    ref="el"
    class="card relative rounded-lg bg-gray-100 p-0.5 shadow-lg dark:bg-gray-900"
    :style="{
      '--x': `${x - (el?.offsetLeft ?? 0)}px`,
      '--y': `${y - (el?.offsetTop ?? 0)}px`,
    }"
  >
    <div class="relative size-full">
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
const { x, y } = useMouse()
const el = ref<HTMLElement | null>(null)
</script>

<style scoped>
.card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    var(--spotlight-size, 200px) circle at var(--x) var(--y),
    var(--spotlight-color-stops, rgb(var(--color-primary-800)), rgb(var(--color-primary-500)), transparent)
  );

  @apply rounded-lg;
}
</style>
