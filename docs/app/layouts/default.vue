<template>
  <main class="main">
    <BackgroundGradient v-if="isHomePage" />
    <div class="relative z-10 flex min-h-screen flex-col dark:text-gray-50">
      <Header />
      <div class="grid grow">
        <slot />
      </div>
      <Footer />
    </div>
  </main>
</template>

<script setup>
const route = useRoute()
const isHomePage = computed(() => route.path === '/' || route.path === '')
</script>
