export default defineAppConfig({
  slugRegex: '^[A-Za-z0-9_-]+$',
  reserveSlug: [
    'api',
    'dashboard',
    '_nuxt',
    '__nuxt_error',
    'favicon.ico',
    'robots.txt',
    'sitemap.xml',
  ],
  ui: {
    colors: {
      primary: 'brand',
      secondary: 'sky',
      neutral: 'slate',
    },
    button: {
      defaultVariants: {
        size: 'md',
      },
      slots: {
        base: 'rounded-[10px]',
      },
    },
  },
})
