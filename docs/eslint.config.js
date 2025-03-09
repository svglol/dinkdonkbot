import antfu from '@antfu/eslint-config'
import { FlatCompat } from '@eslint/eslintrc'
import nuxt from './.nuxt/eslint.config.mjs'

const compat = new FlatCompat()

export default antfu(
  {
    rules: {
      'vue/block-order': ['error', {
        order: ['template', 'script', 'style'],
      }],
    },
  },
  nuxt,
  ...compat.config({
    extends: ['plugin:tailwindcss/recommended'],
    rules: {
      'tailwindcss/no-custom-classname': 'off',
      'tailwindcss/migration-from-tailwind-2': 'off',
    },
  }),
)
