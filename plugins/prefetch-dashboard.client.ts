export default defineNuxtPlugin(() => {
  const router = useRouter()
  
  // Prefetch dashboard routes when user is authenticated
  router.beforeEach((to) => {
    if (to.path.startsWith('/dashboard') && to.path !== '/dashboard/login') {
      const { isAuthenticated } = useAuthToken()
      
      if (isAuthenticated.value) {
        // Preload common dashboard routes using preloadRouteComponents
        const commonRoutes = ['/dashboard/links', '/dashboard/analytics']
        commonRoutes.forEach(route => {
          if (route !== to.path) {
            // Use Nuxt's preloadRouteComponents instead of router.prefetch
            preloadRouteComponents(route).catch(() => {
              // Silently fail if preload doesn't work
            })
          }
        })
      }
    }
  })
})
