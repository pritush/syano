import { createError, defineEventHandler, getCookie, getHeader, getQuery, getRequestURL, setHeader } from 'h3'
// @ts-expect-error Nitro virtual module is generated when experimental.openAPI is enabled.
import { handlersMeta } from '#nitro-internal-virtual/server-handlers-meta'
import { verifyJWTToken } from '~/server/utils/auth'
import { PERMISSIONS, hasAllPermissions } from '~/shared/permissions'

type OpenApiRecord = Record<string, any>

const EXCLUDED_V1_ROUTES = [
  '/api/v1/api-keys',
  '/api/v1/health',
  '/api/v1/metrics',
]

function normalizeRoute(route: string) {
  const parameters: OpenApiRecord[] = []
  let anonymousCtr = 0
  const normalized = route
    .replace(/:(\w+)/g, (_, name) => `{${name}}`)
    .replace(/\/(\*)\//g, () => `/{param${++anonymousCtr}}/`)
    .replace(/\*\*{/, '{')
    .replace(/\/(\*\*)$/g, () => `/{*param${++anonymousCtr}}`)

  for (const match of normalized.matchAll(/{(\*?\w+)}/g)) {
    const name = match[1]
    if (!parameters.some((parameter) => parameter.name === name)) {
      parameters.push({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      })
    }
  }

  return { route: normalized, parameters }
}

function mergeOpenApi(target: OpenApiRecord, source: OpenApiRecord) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] = mergeOpenApi(target[key] || {}, value)
    } else {
      target[key] = value
    }
  }

  return target
}

function defaultTags(route: string) {
  if (route.startsWith('/api/v1/links')) return ['Links']
  if (route.startsWith('/api/v1/analytics')) return ['Analytics']
  if (route.startsWith('/api/v1/tags')) return ['Tags']
  return ['API']
}

function defaultSecurity(route: string) {
  return [{ bearerAuth: [] }, { apiKeyAuth: [] }]
}

function buildSpec(origin: string) {
  const paths: OpenApiRecord = {}
  const components: OpenApiRecord = {
    schemas: {},
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearer: 'JWT or Syano API key',
        description: 'Use Authorization: Bearer <token>. v1 resource routes accept Syano API keys; dashboard management routes accept JWT.',
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Syano API key created from the dashboard.',
      },
    },
  }

  for (const handler of handlersMeta as Array<{ route?: string; method?: string; meta?: OpenApiRecord }>) {
    const sourceRoute = handler.route || ''
    const shouldExclude =
      !sourceRoute.startsWith('/api/v1/') ||
      EXCLUDED_V1_ROUTES.some((route) => sourceRoute === route || sourceRoute.startsWith(`${route}/`))

    if (shouldExclude) {
      continue
    }

    const method = (handler.method || 'get').toLowerCase()
    const { route, parameters } = normalizeRoute(sourceRoute)
    const { $global, ...operationMeta } = handler.meta?.openAPI || {}

    if ($global?.components) {
      mergeOpenApi(components, $global.components)
    }

    const operation = {
      tags: defaultTags(sourceRoute),
      parameters,
      responses: {
        200: { description: 'OK' },
      },
      security: defaultSecurity(sourceRoute),
      ...operationMeta,
    }

    paths[route] = {
      ...(paths[route] || {}),
      [method]: operation,
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'SyanoLink API',
      description: 'URL shortener and link management API with analytics',
      version: '1.0.0',
    },
    servers: [
      {
        url: origin,
        description: 'Current Syano deployment',
      },
    ],
    paths,
    components,
  }
}

export default defineEventHandler(async (event) => {
  const cookieToken = getCookie(event, 'auth_token')
  const authHeader = getHeader(event, 'authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : ''
  const queryToken = (getQuery(event).token as string | undefined) || ''
  const token = cookieToken || bearerToken || queryToken

  const payload = token ? await verifyJWTToken(token, event) : null
  const hasAdminAccess = payload?.isRoot === true || (
    payload?.permissions
      ? hasAllPermissions(payload.permissions, [
          PERMISSIONS.USERS_MANAGE,
          PERMISSIONS.API_MANAGE,
          PERMISSIONS.DATA_MANAGE,
        ])
      : false
  )

  if (!hasAdminAccess) {
    throw createError({
      statusCode: payload ? 403 : 401,
      statusMessage: payload ? 'Only administrators can access API documentation' : 'Authentication required to access API documentation',
    })
  }

  setHeader(event, 'cache-control', 'no-store')
  return buildSpec(getRequestURL(event).origin)
})
