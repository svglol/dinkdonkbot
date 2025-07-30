<template>
  <footer
    class="
      py-4 text-center text-sm text-gray-500
      dark:text-gray-400
    "
  >
    <div
      class="
        mx-auto max-w-7xl px-4
        sm:px-6
        lg:px-8
      "
    >
      <div
        class="
          flex flex-col items-center justify-center gap-4
          md:flex-row
        "
      >
        <div class="flex flex-row items-center gap-4">
          <NuxtLink
            to="/" class="
              hover:text-gray-700
              dark:hover:text-gray-300
            "
          >
            Home
          </NuxtLink>
          <NuxtLink
            to="/terms-of-service" class="
              hover:text-gray-700
              dark:hover:text-gray-300
            "
          >
            Terms of Service
          </NuxtLink>
          <NuxtLink
            to="/privacy-policy" class="
              hover:text-gray-700
              dark:hover:text-gray-300
            "
          >
            Privacy Policy
          </NuxtLink>
        </div>
        <div
          class="
            mt-2
            md:mt-0 md:ml-auto
          "
        >
          <p>© {{ new Date().getFullYear() }} DinkDonk Bot. All rights reserved.</p>
        </div>
      </div>
    </div>
  </footer>
</template>
