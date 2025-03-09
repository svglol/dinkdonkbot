<template>
  <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #1f1b16 0%, #4b3d2e 40%, #7c5523 70%, #5a3b1d 100%); position: relative; overflow: hidden;">

    <div class="relative z-10 flex h-full flex-col items-center justify-center p-8">
      <div class="mb-48 flex items-center justify-center gap-8">
        <img src="/dinkDonk-512.png" class="size-48 drop-shadow-lg">
      </div>

      <div class="absolute bottom-8 left-8">
        <h1 class="mb-4 text-6xl font-extrabold text-white drop-shadow-lg">
          {{ title }}
        </h1>
        <p class="max-w-[80%] text-2xl font-medium text-neutral-200 drop-shadow-lg">
          {{ description }}
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
defineOptions({
  inheritAttrs: false,
})

defineProps<{
  title?: string
  description?: string
}>()
</script>
