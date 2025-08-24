<template>
  <ContentRenderer v-if="home" :value="home" />
</template>

<script setup lang="ts">
const { data: home } = await useAsyncData(() => queryCollection('content').path('/').first())
useSeoMeta({
  title: home.value?.title,
  description: home.value?.description,
})

if (home.value?.ogImage) {
  defineOgImage(home.value.ogImage)
}
</script>
