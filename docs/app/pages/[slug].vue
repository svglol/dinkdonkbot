<template>
  <div class="bg-gray-100 dark:bg-gray-900">
    <ContentRenderer v-if="page" :value="page" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string
const { data: page } = await useAsyncData(() => queryCollection('content').path(`/${slug}`).first())

if (!page.value) {
  throw createError({
    statusCode: 404,
    message: 'Page not found',
  })
}

useSeoMeta({
  title: page.value?.title,
  description: page.value?.description,
})

if (page.value?.ogImage) {
  defineOgImage(page.value.ogImage)
}
</script>
