import { defineCollection, defineContentConfig } from '@nuxt/content'
import { asOgImageCollection } from 'nuxt-og-image/content'

export default defineContentConfig({
  collections: {
    content: defineCollection(
      asOgImageCollection({
        type: 'page',
        source: '**/*.md',
      }),
    ),
  },
})
