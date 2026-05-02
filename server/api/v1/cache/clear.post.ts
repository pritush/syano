import { defineEventHandler, readBody } from 'h3'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { 
  invalidateAllLinkCache, 
  invalidateSettingsCache, 
  invalidateTagsCache,
  useLinkCache,
  useSettingsCache,
  useTagsCache,
  useAnalyticsCache,
} from '~/server/utils/cache'

/**
 * Clear cache entries
 * POST /api/v1/cache/clear
 * 
 * Body: { type: 'all' | 'links' | 'settings' | 'tags' | 'analytics' }
 * 
 * Requires: system:manage permission
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'system:manage')

  const body = await readBody(event)
  const type = body?.type || 'all'

  let cleared = 0

  switch (type) {
    case 'links':
      cleared = useLinkCache().size()
      invalidateAllLinkCache()
      break
    
    case 'settings':
      cleared = useSettingsCache().size()
      invalidateSettingsCache()
      break
    
    case 'tags':
      cleared = useTagsCache().size()
      invalidateTagsCache()
      break
    
    case 'analytics':
      cleared = useAnalyticsCache().size()
      useAnalyticsCache().clear()
      break
    
    case 'all':
    default:
      cleared = 
        useLinkCache().size() +
        useSettingsCache().size() +
        useTagsCache().size() +
        useAnalyticsCache().size()
      
      invalidateAllLinkCache()
      invalidateSettingsCache()
      invalidateTagsCache()
      useAnalyticsCache().clear()
      break
  }

  return {
    success: true,
    data: {
      type,
      entries_cleared: cleared,
      timestamp: new Date().toISOString(),
    },
  }
})
