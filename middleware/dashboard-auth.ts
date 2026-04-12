export default defineNuxtRouteMiddleware((to) => {
  // Early return for non-dashboard routes
  if (!to.path.startsWith('/dashboard')) {
    return
  }

  // Skip auth check for login page
  if (to.path === '/dashboard/login') {
    return
  }

  const { hydrate, isAuthenticated } = useAuthToken()
  
  // Hydrate only once per session
  hydrate()

  // Redirect to login if not authenticated
  if (!isAuthenticated.value) {
    return navigateTo({
      path: '/dashboard/login',
      query: { redirect: to.fullPath },
    })
  }
})

