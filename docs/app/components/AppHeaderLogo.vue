<script setup lang="ts">
const appConfig = useAppConfig()
</script>

<template>
  <UColorModeImage
    :light="appConfig.header?.logo?.light || appConfig.header?.logo?.dark"
    :dark="appConfig.header?.logo?.dark || appConfig.header?.logo?.light"
    :alt="appConfig.header?.logo?.alt || appConfig.header?.title"
    class="h-8 w-auto shrink-0"
  />
    {{ appConfig.header?.title || appConfig.header.title }}
</template>