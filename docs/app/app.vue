<template>
  <NuxtLoadingIndicator
    :color="false"
    class="bg-primary-500"
    :duration="1000"
  />
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk
      ? `${titleChunk} • DinkDonk Bot`
      : 'DinkDonk Bot'
  },
  htmlAttrs: {
    lang: 'en',
  },
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/dinkdonkbot/favicon.ico' },
  ],
})
</script>
