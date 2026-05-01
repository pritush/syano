/**
 * API Documentation Authentication Middleware
 *
 * Protects /_openapi.json so the API schema is not publicly accessible.
 * The Scalar UI is served via /dashboard/api-docs (protected by dashboard-auth).
 * This middleware ensures the raw spec endpoint also requires authentication.
 */

import { verifyJWTToken } from '~/server/utils/auth'
import { PERMISSIONS, hasAllPermissions } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  const path = event.path

  // Only protect the OpenAPI spec endpoint
  if (!path.startsWith('/_openapi')) {
    return
  }

  // Get token from cookie, Authorization header, or ?token= query param
  const cookieToken = getCookie(event, 'auth_token')
  const authHeader = getHeader(event, 'authorization')
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null
  const queryToken = getQuery(event)['token'] as string | undefined

  const token = cookieToken || bearerToken || queryToken

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required to access API documentation',
    })
  }

  const payload = await verifyJWTToken(token, event)

  if (!payload) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired token',
    })
  }

  // Only admins can access the API spec
  const isRoot = payload.isRoot === true
  const adminPermissions = [
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.API_MANAGE,
    PERMISSIONS.DATA_MANAGE,
  ]
  const hasAdminPermissions = hasAllPermissions(payload.permissions, adminPermissions)

  if (!isRoot && !hasAdminPermissions) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only administrators can access API documentation',
    })
  }
})
