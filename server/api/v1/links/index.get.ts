import { defineEventHandler, getQuery, createError, getRequestURL } from 'h3'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'
import { listLinks as listStoredLinks } from '~/server/utils/link-store'

defineRouteMeta({
  openAPI: {
    tags: ['Links'],
    summary: 'List all links',
    description: 'Retrieve a paginated list of all short links with optional filtering by tag or search query. Supports both JWT and API key authentication.',
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    parameters: [
      {
        in: 'query',
        name: 'limit',
        description: 'Number of links to return per page',
        schema: {
          type: 'integer',
          default: 50,
          minimum: 1,
          maximum: 100,
        },
      },
      {
        in: 'query',
        name: 'offset',
        description: 'Number of links to skip for pagination',
        schema: {
          type: 'integer',
          default: 0,
          minimum: 0,
        },
      },
      {
        in: 'query',
        name: 'tag_id',
        description: 'Filter links by tag ID',
        schema: {
          type: 'string',
          format: 'uuid',
        },
      },
      {
        in: 'query',
        name: 'search',
        description: 'Search in slug, URL, title, or comment',
        schema: {
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        description: 'List of links retrieved successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: {
                  type: 'boolean',
                  example: true,
                },
                data: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Link' },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    limit: { type: 'integer' },
                    offset: { type: 'integer' },
                    total: { type: 'integer' },
                    has_more: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      401: {
        description: 'Unauthorized - Invalid or missing authentication',
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
      429: {
        description: 'Too many requests - Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
    $global: {
      components: {
        schemas: {
          Link: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique link identifier',
              },
              slug: {
                type: 'string',
                description: 'Short URL slug',
                example: 'abc123',
              },
              url: {
                type: 'string',
                format: 'uri',
                description: 'Destination URL',
                example: 'https://example.com',
              },
              short_url: {
                type: 'string',
                format: 'uri',
                description: 'Full short URL',
                example: 'https://yourdomain.com/abc123',
              },
              title: {
                type: 'string',
                nullable: true,
                description: 'Link title',
              },
              description: {
                type: 'string',
                nullable: true,
                description: 'Link description',
              },
              comment: {
                type: 'string',
                nullable: true,
                description: 'Internal comment',
              },
              tag_id: {
                type: 'string',
                format: 'uuid',
                nullable: true,
                description: 'Associated tag ID',
              },
              expiration: {
                type: 'string',
                format: 'date-time',
                nullable: true,
                description: 'Link expiration date',
              },
              cloaking: {
                type: 'boolean',
                description: 'Whether URL cloaking is enabled',
              },
              redirect_with_query: {
                type: 'boolean',
                description: 'Whether to preserve query parameters',
              },
              created_at: {
                type: 'string',
                format: 'date-time',
                description: 'Creation timestamp',
              },
              updated_at: {
                type: 'string',
                format: 'date-time',
                description: 'Last update timestamp',
              },
              click_count: {
                type: 'integer',
                description: 'Total number of clicks',
              },
            },
          },
          Error: {
            type: 'object',
            properties: {
              statusCode: {
                type: 'integer',
                description: 'HTTP status code',
              },
              statusMessage: {
                type: 'string',
                description: 'HTTP status text',
              },
              message: {
                type: 'string',
                description: 'Human-readable error message',
              },
              data: {
                type: 'object',
                description: 'Additional error details',
              },
            },
          },
        },
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearer: 'JWT or Syano API key',
            description: 'Use a dashboard JWT or an API key in the Authorization header.',
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'Syano API key created from the dashboard.',
          },
        },
      },
    },
  },
})

/**
 * List links with pagination and filtering
 * GET /api/v1/links
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  // Authenticate (supports both JWT and API keys)
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'links:read')
  
  // Rate limit (only for API key requests, skip for dashboard JWT)
  if (auth.type === 'apikey') {
    await checkRateLimit(event, { 
      id: auth.apiKeyId!, 
      user_id: auth.userId,
      name: auth.apiKeyName!,
      permissions: auth.permissions,
      key_prefix: auth.apiKeyPrefix!
    }, '/api/v1/links')
  }
  
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 50, 100)
  const offset = Math.max(Number(query.offset) || 0, 0)
  const search = (query.search as string) || ''
  const tag_id = (query.tag_id as string) || ''
  
  const { items } = await listStoredLinks(event, {
    limit: Math.min(limit + offset, 1000),
    tag_id: tag_id || undefined,
  })

  const normalizedSearch = search.trim().toLowerCase()
  const filtered = normalizedSearch
    ? items.filter((link) =>
        [link.slug, link.url, link.title, link.comment]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
      )
    : items

  const results = filtered.slice(offset, offset + limit)
  const count = filtered.length
  
  return {
    success: true,
    data: results.map((link) => ({
      id: link.id,
      slug: link.slug,
      url: link.url,
      short_url: `${getRequestURL(event).origin}/${link.slug}`,
      title: link.title,
      description: link.description,
      comment: link.comment,
      tag_id: link.tag_id,
      expiration: link.expiration,
      cloaking: link.cloaking,
      redirect_with_query: link.redirect_with_query,
      created_at: link.created_at,
      updated_at: link.updated_at,
      click_count: link.click_count,
    })),
    pagination: {
      limit,
      offset,
      total: count,
      has_more: offset + limit < count,
    },
  }
})
