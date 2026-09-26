import { createError, defineEventHandler, readBody, setCookie } from 'h3'
import { useRuntimeConfig } from '#imports'
import { loginSchema } from '~/shared/schemas/user'
import { WILDCARD_PERMISSION } from '~/shared/permissions'
import { findUserByUsername, verifyPassword, signJWT } from '~/server/utils/auth'
import { checkLoginRateLimit, recordFailedLogin, clearLoginRateLimit } from '~/server/utils/login-rate-limit'

defineRouteMeta({
  openAPI: {
    tags: ['Authentication'],
    summary: 'User login',
    description: 'Authenticate a user and receive a JWT token. Supports both root admin (from environment) and database users.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['username', 'password'],
            properties: {
              username: {
                type: 'string',
                description: 'Username',
                example: 'admin',
              },
              password: {
                type: 'string',
                format: 'password',
                description: 'Password',
                example: 'admin123',
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Login successful',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: {
                  type: 'string',
                  description: 'JWT authentication token',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
                user: {
                  $ref: '#/components/schemas/User',
                },
              },
            },
          },
        },
      },
      400: {
        description: 'Invalid request body',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      401: {
        description: 'Invalid credentials or account disabled',
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
          User: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'User ID',
              },
              username: {
                type: 'string',
                description: 'Username',
              },
              displayName: {
                type: 'string',
                description: 'Display name',
              },
              permissions: {
                type: 'array',
                items: { type: 'string' },
                description: 'User permissions',
              },
              isRoot: {
                type: 'boolean',
                description: 'Whether user is root admin',
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
                description: 'Error message',
              },
              message: {
                type: 'string',
                description: 'Detailed error message',
              },
            },
          },
        },
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearer: 'JWT',
            description: 'JWT token obtained from /api/auth/login',
          },
          apiKeyAuth: {
            type: 'http',
            scheme: 'bearer',
            bearer: 'API Key',
            description: 'API key created from dashboard',
          },
        },
      },
    },
  },
})

export default defineEventHandler(async (event) => {
  // Rate limit check — blocks before any auth processing
  checkLoginRateLimit(event)

  const body = await readBody(event)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid login payload',
    })
  }

  const { username, password } = parsed.data
  const config = useRuntimeConfig(event)

  // Generic error message for all auth failures — prevents username enumeration
  const INVALID_CREDENTIALS_ERROR = 'Invalid username or password'

  // 1. Check root user (from .env)
  if (username === config.siteUser && password === config.siteToken) {
    clearLoginRateLimit(event)

    const token = await signJWT({
      sub: 'root',
      username: config.siteUser,
      displayName: 'Root Admin',
      permissions: [WILDCARD_PERMISSION],
      isRoot: true,
    }, event)

    // Set httpOnly cookie for browser-based clients
    setCookie(event, 'auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days (matches JWT expiry)
      path: '/',
    })

    return {
      token,
      user: {
        id: 'root',
        username: config.siteUser,
        displayName: 'Root Admin',
        permissions: [WILDCARD_PERMISSION],
        isRoot: true,
      },
    }
  }

  // 2. Check database users
  const dbUser = await findUserByUsername(event, username)

  if (!dbUser) {
    recordFailedLogin(event)
    throw createError({
      statusCode: 401,
      statusMessage: INVALID_CREDENTIALS_ERROR,
    })
  }

  // Disabled accounts get the same error as non-existent users (prevents enumeration)
  if (!dbUser.is_active) {
    recordFailedLogin(event)
    throw createError({
      statusCode: 401,
      statusMessage: INVALID_CREDENTIALS_ERROR,
    })
  }

  const passwordValid = await verifyPassword(password, dbUser.password_hash)
  if (!passwordValid) {
    recordFailedLogin(event)
    throw createError({
      statusCode: 401,
      statusMessage: INVALID_CREDENTIALS_ERROR,
    })
  }

  // Successful login — clear rate limit
  clearLoginRateLimit(event)

  const permissions = (dbUser.permissions || []) as string[]

  const token = await signJWT({
    sub: dbUser.id,
    username: dbUser.username,
    displayName: dbUser.display_name || dbUser.username,
    permissions,
    isRoot: false,
  }, event)

  // Set httpOnly cookie for browser-based clients
  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days (matches JWT expiry)
    path: '/',
  })

  return {
    token,
    user: {
      id: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.display_name || dbUser.username,
      permissions,
      isRoot: false,
    },
  }
})
