/**
 * Syano Permission System — Single source of truth
 * 
 * All permission keys, labels, categories, and preset roles
 * are defined here and shared between server and client.
 */

// ── Permission Keys ───────────────────────────────────────
export const PERMISSIONS = {
  LINKS_READ: 'links:read',
  LINKS_CREATE: 'links:create',
  LINKS_EDIT: 'links:edit',
  LINKS_DELETE: 'links:delete',
  ANALYTICS_READ: 'analytics:read',
  TAGS_MANAGE: 'tags:manage',
  SETTINGS_MANAGE: 'settings:manage',
  DATA_MANAGE: 'data:manage',
  USERS_MANAGE: 'users:manage',
  API_MANAGE: 'api:manage',
} as const

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS]

/** Wildcard permission — root user always has this */
export const WILDCARD_PERMISSION = '*'

// ── Permission Metadata ───────────────────────────────────
export interface PermissionInfo {
  key: PermissionKey
  label: string
  description: string
  icon: string
  category: string
}

export const PERMISSION_CATEGORIES = [
  { id: 'links', label: 'Links', icon: 'lucide:link-2' },
  { id: 'analytics', label: 'Analytics', icon: 'lucide:chart-column' },
  { id: 'tags', label: 'Tags', icon: 'lucide:tags' },
  { id: 'settings', label: 'Settings', icon: 'lucide:settings-2' },
  { id: 'system', label: 'System', icon: 'lucide:shield' },
] as const

export const ALL_PERMISSIONS: PermissionInfo[] = [
  // Links
  { key: PERMISSIONS.LINKS_READ, label: 'View Links', description: 'See the links list and link details', icon: 'lucide:eye', category: 'links' },
  { key: PERMISSIONS.LINKS_CREATE, label: 'Create Links', description: 'Create new short links', icon: 'lucide:plus-circle', category: 'links' },
  { key: PERMISSIONS.LINKS_EDIT, label: 'Edit Links', description: 'Edit existing links, slugs, and metadata', icon: 'lucide:pencil', category: 'links' },
  { key: PERMISSIONS.LINKS_DELETE, label: 'Delete Links', description: 'Permanently delete links', icon: 'lucide:trash-2', category: 'links' },
  // Analytics
  { key: PERMISSIONS.ANALYTICS_READ, label: 'View Analytics', description: 'View analytics dashboard, charts, and logs', icon: 'lucide:chart-column', category: 'analytics' },
  // Tags
  { key: PERMISSIONS.TAGS_MANAGE, label: 'Manage Tags', description: 'Create, edit, and delete tags', icon: 'lucide:tags', category: 'tags' },
  // Settings
  { key: PERMISSIONS.SETTINGS_MANAGE, label: 'Manage Settings', description: 'Change homepage and bio settings', icon: 'lucide:settings-2', category: 'settings' },
  // System
  { key: PERMISSIONS.DATA_MANAGE, label: 'Data Operations', description: 'Backup, restore, and migrate database', icon: 'lucide:database', category: 'system' },
  { key: PERMISSIONS.USERS_MANAGE, label: 'Manage Users', description: 'Add, remove, and configure user access', icon: 'lucide:users', category: 'system' },
  { key: PERMISSIONS.API_MANAGE, label: 'Manage API Keys', description: 'Create and manage API keys', icon: 'lucide:key', category: 'system' },
]

// ── Preset Roles ──────────────────────────────────────────
export interface PresetRole {
  id: string
  label: string
  description: string
  icon: string
  color: string
  permissions: PermissionKey[]
}

export const PRESET_ROLES: PresetRole[] = [
  {
    id: 'viewer',
    label: 'Viewer',
    description: 'Can view links and analytics only',
    icon: 'lucide:eye',
    color: 'blue',
    permissions: [PERMISSIONS.LINKS_READ, PERMISSIONS.ANALYTICS_READ],
  },
  {
    id: 'editor',
    label: 'Editor',
    description: 'Can view, create, and edit links',
    icon: 'lucide:pencil',
    color: 'amber',
    permissions: [
      PERMISSIONS.LINKS_READ,
      PERMISSIONS.LINKS_CREATE,
      PERMISSIONS.LINKS_EDIT,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.TAGS_MANAGE,
    ],
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Full link management without system access',
    icon: 'lucide:shield',
    color: 'teal',
    permissions: [
      PERMISSIONS.LINKS_READ,
      PERMISSIONS.LINKS_CREATE,
      PERMISSIONS.LINKS_EDIT,
      PERMISSIONS.LINKS_DELETE,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.TAGS_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Full access to all features',
    icon: 'lucide:crown',
    color: 'red',
    permissions: [
      PERMISSIONS.LINKS_READ,
      PERMISSIONS.LINKS_CREATE,
      PERMISSIONS.LINKS_EDIT,
      PERMISSIONS.LINKS_DELETE,
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.TAGS_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.DATA_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.API_MANAGE,
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────

/** Check if a permission array includes the given permission (or wildcard) */
export function hasPermission(userPermissions: string[], permission: PermissionKey): boolean {
  return userPermissions.includes(WILDCARD_PERMISSION) || userPermissions.includes(permission)
}

/** Check if a permission array includes ALL of the given permissions */
export function hasAllPermissions(userPermissions: string[], permissions: PermissionKey[]): boolean {
  return permissions.every(p => hasPermission(userPermissions, p))
}

/** Check if a permission array includes ANY of the given permissions */
export function hasAnyPermission(userPermissions: string[], permissions: PermissionKey[]): boolean {
  return permissions.some(p => hasPermission(userPermissions, p))
}

/** Find the matching preset role for a set of permissions (or null if custom) */
export function matchPresetRole(permissions: PermissionKey[]): PresetRole | null {
  const sorted = [...permissions].sort()
  return PRESET_ROLES.find(role => {
    const roleSorted = [...role.permissions].sort()
    return roleSorted.length === sorted.length && roleSorted.every((p, i) => p === sorted[i])
  }) ?? null
}

/** Check if permissions represent root/wildcard access */
export function isWildcard(permissions: string[]): boolean {
  return permissions.includes(WILDCARD_PERMISSION)
}
