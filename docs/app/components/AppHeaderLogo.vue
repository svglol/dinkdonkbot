<template>
  <img class="h-8 w-auto shrink-0" :src="usePublicAsset(appConfig.header?.logo?.light || appConfig.header?.logo?.dark)" :alt="appConfig.header?.logo?.alt || appConfig.header?.title">
  {{ appConfig.header?.title || appConfig.header.title }}
</template>

<script setup lang="ts">
import { usePublicAsset } from '../composables/usePublicAsset'

const appConfig = useAppConfig()
</script>
