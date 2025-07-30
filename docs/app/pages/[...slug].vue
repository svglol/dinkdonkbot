<template>
  <div
    class="
      bg-neutral-100
      dark:bg-neutral-900
    "
  >
    <ContentRenderer v-if="page" :value="page" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { data: page } = await useAsyncData(`page-${route.path}`, () => {
  return queryCollection('content').path(route.path).first()
})

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
