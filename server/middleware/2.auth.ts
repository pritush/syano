import { createError, defineEventHandler, getRequestURL } from 'h3'
import { getAuthUser } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname

  if (!pathname.startsWith('/api/')) {
    return
  }

  // Public routes — no auth needed
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

  // Login endpoint must be public
  if (pathname === '/api/auth/login') {
    return
  }

  // API docs routes handle their own auth via query token
  if (pathname === '/api/scalar' || pathname === '/api/openapi') {
    return
  }

  // V1 API endpoints handle their own authentication (unified auth)
  if (pathname.startsWith('/api/v1/')) {
    return
  }

  // Verify authentication (JWT or legacy token)
  const user = await getAuthUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  // Attach user to event context for downstream handlers
  event.context.auth = user
})
