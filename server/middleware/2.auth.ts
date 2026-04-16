import { createError, defineEventHandler, getHeader, getRequestURL } from 'h3'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler((event) => {
  const pathname = getRequestURL(event).pathname

  if (!pathname.startsWith('/api/')) {
    return
  }

  if (pathname === '/api/settings' && (event.method || 'GET') === 'GET') {
    return
  }

  // Allow Nuxt Icon API requests
  if (pathname.startsWith('/api/_nuxt_icon/')) {
    return
  }

  // Allow QR code generation (no auth needed, no sensitive data)
  if (pathname.startsWith('/api/qr/')) {
    return
  }

  const runtimeConfig = useRuntimeConfig(event)
  const authorization = getHeader(event, 'authorization') || ''
  const username = getHeader(event, 'x-site-user') || ''
  
  const expectedToken = `Bearer ${runtimeConfig.siteToken}`
  const expectedUser = runtimeConfig.siteUser

  if (authorization !== expectedToken || username !== expectedUser) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }
})
