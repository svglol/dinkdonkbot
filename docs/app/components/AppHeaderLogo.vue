<template>
  <div class="flex shrink-0 items-end gap-1.5">
    <img class="h-8 w-auto shrink-0" :src="usePublicAsset(appConfig.header?.logo?.light || appConfig.header?.logo?.dark)" :alt="appConfig.header?.logo?.alt || appConfig.header?.title">
    <span
      class="
        text-xl font-bold text-highlighted
        focus-visible:outline-primary
      "
    >{{ appConfig.header?.title || appConfig.header.title }} </span>
  </div>
</template>

<script setup lang="ts">
import { usePublicAsset } from '../composables/usePublicAsset'

const appConfig = useAppConfig()
</script>
