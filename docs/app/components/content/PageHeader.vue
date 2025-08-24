<template>
  <div>
    <div
      class="
        mx-auto w-full max-w-3xl px-4 py-12
        sm:px-6
        lg:px-8
      "
    >
      <h1
        class="
          text-3xl font-bold tracking-tight text-gray-900
          sm:text-4xl
          dark:text-white
        "
      >
        <slot name="title" />
      </h1>
      <p
        v-if="$slots.subtitle" class="
          mt-3 text-lg text-gray-500
          dark:text-gray-400
        "
      >
        <slot name="subtitle" />
      </p>
    </div>
  </div>
</template>
