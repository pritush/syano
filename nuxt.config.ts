import { randomUUID } from 'node:crypto'

const siteToken = process.env.NUXT_SITE_TOKEN || randomUUID()
const siteUser = process.env.NUXT_SITE_USER || 'admin'
const databaseUrl = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL || ''
const cacheTtl = Number(process.env.NUXT_CACHE_TTL || 30)
const cacheStaleTtl = Number(process.env.NUXT_CACHE_STALE_TTL || 30)

export default defineNuxtConfig({
  compatibilityDate: '2024-12-01',
  srcDir: '.',
  dir: {
    app: 'app',
  },
  devtools: { enabled: process.env.NODE_ENV === 'development' },
  modules: ['@nuxt/ui', '@nuxt/icon', '@nuxtjs/color-mode'],
  css: ['~/assets/css/tailwind.css'],
  
  // Performance optimizations
  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: true,
    viewTransition: true,
  },
  
  app: {
    head: {
      titleTemplate: '%s',
      title: 'Syano | Open Source URL Shortener',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'A powerful, self-hosted URL shortener with analytics, link-in-bio pages, and advanced link management features.' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico?v=1' },
        { rel: 'shortcut icon', type: 'image/x-icon', href: '/favicon.ico?v=1' }
      ]
    },
    pageTransition: false,
    layoutTransition: false,
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'syano-color-mode',
  },
  ui: {
    colorMode: true,
    theme: {
      defaultVariants: {
        color: 'primary',
        size: 'md',
      },
    },
    experimental: {
      componentDetection: true,
    },
  },
  runtimeConfig: {
    databaseUrl,
    siteToken,
    siteUser,
    cacheTtl,
    cacheStaleTtl,
    redirectStatusCode: Number(process.env.NUXT_REDIRECT_STATUS_CODE || 301),
    redirectWithQuery: process.env.NUXT_REDIRECT_WITH_QUERY === 'true',
    homeURL: process.env.NUXT_HOME_URL || '',
    caseSensitive: process.env.NUXT_CASE_SENSITIVE === 'true',
    notFoundRedirect: process.env.NUXT_NOT_FOUND_REDIRECT || '',
    public: {
      previewMode: process.env.NUXT_PUBLIC_PREVIEW_MODE || '',
      slugDefaultLength: Number(process.env.NUXT_PUBLIC_SLUG_DEFAULT_LENGTH || 6),
    },
  },
  routeRules: {
    '/': {
      headers: {
        'cache-control': `s-maxage=${cacheTtl}, stale-while-revalidate=${cacheStaleTtl}`,
      },
    },
    '/dashboard/**': { 
      ssr: false,
      // Preload critical dashboard assets
    },
    '/api/**': {
      headers: {
        'cache-control': 'no-cache, no-store, must-revalidate',
      },
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
})
