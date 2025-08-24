<template>
  <div
    ref="el"
    class="
      card relative rounded-lg bg-neutral-200 p-0.5 shadow-lg
      dark:bg-neutral-800
    "
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
    var(--spotlight-color-stops, var(--color-primary-800), var(--color-primary-500), transparent)
  );
  border-radius: 0.5rem;
}
</style>
