<template>
  <main class="main">
    <BackgroundGradient />
    <div class="relative z-10 flex min-h-screen flex-col dark:text-gray-50">
      <Header />
      <div class="grid grow">
        <slot />
      </div>
    </div>
  </main>
</template>
