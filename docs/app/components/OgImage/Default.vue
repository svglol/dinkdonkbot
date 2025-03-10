<template>
  <div class="relative h-screen w-full bg-neutral-900">
    <svg
      class="absolute inset-0 size-full opacity-50"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="blurFilter" x="-10" y="-10" width="140" height="140">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.9" />
        </filter>
      </defs>
      <polygon
        points="53.483,-112.997 54.405,-18.459 68.639,-107.187 56.149,-17.084 82.152,-90.386 57.604,-14.482 92.559,-64.416 58.613,-10.936 98.731,-32.09 59.065,-6.83 100,3.088 58.913,-2.608 96.228,37.307 58.172,1.271 87.823,66.858 56.924,4.387 75.699,88.538 55.302,6.403 61.166,100 53.483,7.1 45.801,100 51.665,6.403 31.268,88.538 50.043,4.387 19.143,66.858 48.794,1.271 10.739,37.307 48.054,-2.608 6.967,3.088 47.902,-6.83 8.236,-32.09 48.354,-10.936 14.408,-64.416 49.363,-14.482 24.815,-90.386 50.818,-17.084 38.328,-107.187 52.562,-18.459 53.483,-112.997"
        fill="#eab308"
        filter="url(#blurFilter)"
        transform="scale(2) rotate(10) translate(-10, -10)"
      />
      <polygon
        points="53.483,-112.997 54.405,-18.459 68.639,-107.187 56.149,-17.084 82.152,-90.386 57.604,-14.482 92.559,-64.416 58.613,-10.936 98.731,-32.09 59.065,-6.83 100,3.088 58.913,-2.608 96.228,37.307 58.172,1.271 87.823,66.858 56.924,4.387 75.699,88.538 55.302,6.403 61.166,100 53.483,7.1 45.801,100 51.665,6.403 31.268,88.538 50.043,4.387 19.143,66.858 48.794,1.271 10.739,37.307 48.054,-2.608 6.967,3.088 47.902,-6.83 8.236,-32.09 48.354,-10.936 14.408,-64.416 49.363,-14.482 24.815,-90.386 50.818,-17.084 38.328,-107.187 52.562,-18.459 53.483,-112.997"
        fill="#facc15"
        filter="url(#blurFilter)"
        opacity="0.5"
        transform="scale(2) rotate(0) translate(-3, 0)"
      />
    </svg>
    <div class="relative z-10 flex size-full flex-col items-center justify-center">
      <div class="mb-[8%] ml-[55%] flex items-center justify-center gap-8">
        <img src="/dinkDonk-512.png" class="size-48 drop-shadow-lg">
      </div>
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
