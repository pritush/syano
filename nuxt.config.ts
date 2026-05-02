import { randomUUID } from 'node:crypto'

const siteToken = process.env.NUXT_SITE_TOKEN || randomUUID()
const siteUser = process.env.NUXT_SITE_USER || 'admin'
// DO NOT read DATABASE_URL at build time - it will be read at runtime
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
  
  // Vite configuration
  vite: {
    build: {
      sourcemap: false, // Disable sourcemaps in production to avoid warnings
    },
  },
  
  // Performance optimizations
  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: true,
    viewTransition: true,
  },
  
  // Nitro configuration
  nitro: {
    experimental: {
      openAPI: true,
    },
    openAPI: {
      meta: {
        title: 'SyanoLink API',
        description: 'URL shortener and link management API with analytics',
        version: '1.0.0',
      },
      production: 'runtime',
      ui: {
        // Scalar UI is disabled here — it's embedded in /dashboard/api-docs instead
        scalar: false,
      },
    },
    future: {
      nativeSWR: true,
    },
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
    // Database URL should ONLY be accessed at runtime, never at build time
    // Nuxt will automatically map NUXT_DATABASE_URL env var to this
    databaseUrl: '', // Will be populated from NUXT_DATABASE_URL at runtime
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
    '/api/qr/**': {
      isr: 60 * 60 * 24 * 7, // Cache QR codes for 7 days
      headers: {
        'cache-control': 'public, max-age=604800, immutable',
      },
    },
    '/api/v1/tags': {
      isr: 180, // Cache tags list for 3 minutes
    },
    '/api/v1/analytics/**': {
      isr: 300, // Cache analytics for 5 minutes
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
