<template>
  <div class="flex flex-col items-center justify-center gap-16 px-2 py-16">
    <img :src="img" class="relative mx-auto size-48">
    <span class="text-center text-4xl font-semibold text-gray-900 dark:text-gray-200">
      <slot name="title" />
    </span>
    <span class="text-center text-lg font-semibold text-gray-500 dark:text-gray-400">
      <slot name="subtitle" />
    </span>
    <div class="grid w-full max-w-screen-xl grid-cols-1 gap-8 lg:grid-cols-3">
      <slot name="cards" />
    </div>

    <UButton size="xl" class="px-8 py-4" :to="link" target="_blank">
      <slot name="callToAction" />
    </UButton>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  img: string
  link: string
}>()
</script>
