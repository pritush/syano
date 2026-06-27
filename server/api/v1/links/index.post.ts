import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'
import { buildShortLink, createLink, getLink } from '~/server/utils/link-store'
import { createLinkSchema } from '~/shared/schemas/link'
import { loadSiteSettingsForHomepage } from '~/server/utils/site-settings'
import { useDrizzle } from '~/server/utils/db'
import { sender_ids } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

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

  // Validate sender_id if TRAI mode is enabled
  let senderIdName: string | null = null
  if (data.sender_id) {
    const db = await useDrizzle(event)
    const senderId = await db.query.sender_ids.findFirst({
      where: eq(sender_ids.id, data.sender_id),
    })

    if (!senderId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Invalid sender ID — the specified sender ID does not exist',
      })
    }

    if (!senderId.is_active) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: `Sender ID '${senderId.name}' is inactive`,
      })
    }

    senderIdName = senderId.name
  } else {
    // Check if TRAI mode is on and sender_id is required
    const settings = await loadSiteSettingsForHomepage(event)
    if (settings.trai_sms_enabled) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'TRAI SMS Compliance is enabled — a sender ID is required when creating links',
      })
    }
  }

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
      short_url: buildShortLink(event, link.slug, senderIdName),
      title: link.title,
      description: link.description,
      comment: link.comment,
      tag_id: link.tag_id,
      sender_id: link.sender_id,
      sender_id_name: senderIdName,
      expiration: link.expiration,
      cloaking: link.cloaking,
      redirect_with_query: link.redirect_with_query,
      created_at: link.created_at,
      updated_at: link.updated_at,
    },
  }
})
