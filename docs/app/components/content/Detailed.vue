<template>
  <div class="flex flex-col items-center justify-center gap-16 px-2 py-8">
    <span
      class="
        text-2xl font-semibold text-gray-800
        dark:text-gray-200
      "
    ><slot name="title" /></span>
    <div class="grid w-full max-w-screen-xl grid-cols-1 gap-8">
      <slot name="content" />
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
