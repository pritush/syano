import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'
import { buildShortLink, createLink, getLink } from '~/server/utils/link-store'
import { createLinkSchema } from '~/shared/schemas/link'

defineRouteMeta({
  openAPI: {
    tags: ['Links'],
    summary: 'Create a new link',
    description: 'Create a new short link with optional custom slug, title, and settings. If no slug is provided, one will be generated automatically.',
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['url'],
            properties: {
              url: {
                type: 'string',
                format: 'uri',
                description: 'Destination URL',
                example: 'https://example.com',
              },
              slug: {
                type: 'string',
                description: 'Custom slug (optional, auto-generated if not provided)',
                example: 'my-link',
              },
              title: {
                type: 'string',
                description: 'Link title',
                example: 'My Example Link',
              },
              description: {
                type: 'string',
                description: 'Link description',
              },
              comment: {
                type: 'string',
                description: 'Internal comment (not visible to visitors)',
              },
              tag_id: {
                type: 'string',
                format: 'uuid',
                description: 'Tag ID to associate with this link',
              },
              expiration: {
                type: 'integer',
                minimum: 1,
                description: 'Expiration time in seconds from now',
              },
              password: {
                type: 'string',
                description: 'Password protection for the link',
              },
              cloaking: {
                type: 'boolean',
                description: 'Enable URL cloaking',
                default: false,
              },
              redirect_with_query: {
                type: 'boolean',
                description: 'Preserve query parameters in redirect',
                default: false,
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Link created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: { $ref: '#/components/schemas/Link' },
              },
            },
          },
        },
      },
      400: {
        description: 'Bad Request - Validation failed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      403: {
        description: 'Forbidden - Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      409: {
        description: 'Conflict - Slug already exists',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      429: {
        description: 'Too many requests',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
})

/**
 * Create a new short link
 * POST /api/v1/links
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  // Authenticate
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'links:create')
  
  // Rate limit (only for API key requests)
  if (auth.type === 'apikey') {
    await checkRateLimit(event, {
      id: auth.apiKeyId!,
      user_id: auth.userId,
      name: auth.apiKeyName!,
      permissions: auth.permissions,
      key_prefix: auth.apiKeyPrefix!
    }, '/api/v1/links')
  }
  
  // Parse and validate body
  const runtimeConfig = useRuntimeConfig(event)
  const body = await readBody(event)
  const validation = createLinkSchema(runtimeConfig.public.slugDefaultLength).safeParse(body)
  
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Validation failed',
      data: validation.error.errors,
    })
  }
  
  const data = validation.data

  if (data.slug && await getLink(event, data.slug)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: `Slug '${data.slug}' is already in use`,
    })
  }
  
  const link = await createLink(event, data)
  
  return {
    success: true,
    data: {
      id: link.id,
      slug: link.slug,
      url: link.url,
      short_url: buildShortLink(event, link.slug),
      title: link.title,
      description: link.description,
      comment: link.comment,
      tag_id: link.tag_id,
      expiration: link.expiration,
      cloaking: link.cloaking,
      redirect_with_query: link.redirect_with_query,
      created_at: link.created_at,
      updated_at: link.updated_at,
    },
  }
})
