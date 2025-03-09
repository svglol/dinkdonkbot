<template>
  <main class="main">
    <div class="fixed inset-0 z-0 overflow-hidden">
      <BackgroundGradient />
    </div>
    <div class="relative z-10 flex min-h-screen flex-col dark:text-gray-50">
      <Header />
      <div class="grid grow">
        <slot />
      </div>
    </div>
  </main>
</template>
