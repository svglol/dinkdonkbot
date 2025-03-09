<template>
  <SpotlightCard v-if="!disableSpotlight">
    <div class="flex size-full flex-col rounded-lg bg-gray-100 p-8 shadow dark:bg-gray-900">
      <UIcon v-if="icon" :name="icon" size="2xl" class="text-primary-500 dark:text-primary-400" />
      <span class="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-200"><slot name="title" /></span>
      <span class="mt-4 whitespace-pre-line text-sm font-semibold text-gray-500 dark:text-gray-400">
        <slot name="subtitle" />
      </span>
    </div>
  </SpotlightCard>
  <div v-else class="flex size-full flex-col rounded-lg bg-gray-100 p-8 shadow dark:bg-gray-900">
    <UIcon v-if="icon" :name="icon" size="2xl" class="text-primary-500 dark:text-primary-400" />
    <span class="mt-2 text-xl font-semibold text-gray-800 dark:text-gray-200"><slot name="title" /></span>
    <span class="mt-4 whitespace-pre-line text-sm font-semibold text-gray-500 dark:text-gray-400">
      <slot name="subtitle" />
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  disableSpotlight?: boolean
}>()
</script>
