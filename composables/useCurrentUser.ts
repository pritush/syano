import { hasPermission, hasAnyPermission, hasAllPermissions, isWildcard, type PermissionKey } from '~/shared/permissions'
import type { AuthUserInfo } from '~/composables/useAuthToken'

export function useCurrentUser() {
  const { user, token, isAuthenticated } = useAuthToken()

  const currentUser = computed<AuthUserInfo | null>(() => user.value)

  const isRoot = computed(() => {
    if (!user.value) return false
    return user.value.isRoot || isWildcard(user.value.permissions)
  })

  const permissions = computed(() => user.value?.permissions || [])

  function can(permission: PermissionKey): boolean {
    return hasPermission(permissions.value, permission)
  }

  function canAll(...perms: PermissionKey[]): boolean {
    return hasAllPermissions(permissions.value, perms)
  }

  function canAny(...perms: PermissionKey[]): boolean {
    return hasAnyPermission(permissions.value, perms)
  }

  return {
    currentUser,
    isRoot,
    isAuthenticated,
    permissions,
    can,
    canAll,
    canAny,
  }
}
