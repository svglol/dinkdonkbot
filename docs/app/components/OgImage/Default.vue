<template>
  <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #1f1b16 0%, #4b3d2e 40%, #7c5523 70%, #5a3b1d 100%); position: relative; overflow: hidden;">
    <div style="position: absolute; top: -100px; left: 25%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%); border-radius: 50%;" /> 
    <div style="position: absolute; bottom: -100px; right: 25%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 70%); border-radius: 50%;" />
    
    <div class="relative z-10 flex flex-col justify-center items-center h-full p-8">
      <div class="flex items-center gap-8 mb-48 justify-center">
        <img src="/dinkDonk-512.png" class="w-48 h-48 drop-shadow-lg">
      </div>

      <div class="absolute bottom-8 left-8">
        <h1 class="text-6xl font-extrabold text-white drop-shadow-lg mb-4">
          {{ title || 'Your Awesome Title' }}
        </h1>
        <p class="text-2xl font-medium text-neutral-200 drop-shadow-lg max-w-[80%]">
          {{ description || 'Add a compelling description here' }}
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
