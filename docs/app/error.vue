<template>
  <div />
</template>

<script setup lang="ts">
import type { NuxtError } from 'nuxt/app'

const { error } = defineProps<{
  error: NuxtError
}>()

console.error('Encountered error:', error)

onMounted(() => {
  clearError({ redirect: '/' })
})

useHead({
  title: 'Redirecting...',
})
</script>
