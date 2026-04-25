<script setup lang="ts">
import { PERMISSIONS } from '~/shared/permissions'

const route = useRoute()
const { clearToken, user } = useAuthToken()
const { isRoot, can } = useCurrentUser()
const colorMode = useColorMode()
const sidebarOpen = ref(false)
const sidebarCollapsed = ref(false)

useHead({
  bodyAttrs: {
    class: 'sy-dashboard-body',
  },
})

const navigation = computed(() => {
  const items = [
    {
      label: 'Links',
      to: '/dashboard/links',
      icon: 'lucide:link-2',
      show: true,
    },
    {
      label: 'Analytics',
      to: '/dashboard/analytics',
      icon: 'lucide:chart-column',
      show: true,
    },
    {
      label: 'Tags',
      to: '/dashboard/tags',
      icon: 'lucide:tags',
      show: true,
    },
    {
      label: 'Homepage Settings',
      to: '/dashboard/settings',
      icon: 'lucide:settings-2',
      show: isRoot.value || can(PERMISSIONS.SETTINGS_MANAGE),
    },
    {
      label: 'User Management',
      to: '/dashboard/users',
      icon: 'lucide:users',
      show: isRoot.value,
    },
    {
      label: 'Data Ops',
      to: '/dashboard/migrate',
      icon: 'lucide:database',
      show: isRoot.value,
    },
  ]

  return items.filter(item => item.show)
})

const userInitials = computed(() => {
  if (!user.value) return 'SY'
  const name = user.value.displayName || user.value.username
  const parts = name.split(/[\s._-]+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
})

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function closeSidebar() {
  if (isMobile.value) {
    sidebarOpen.value = false
  }
}

function toggleCollapse() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const isMobile = ref(false)
function updateIsMobile() {
  if (import.meta.client) {
    isMobile.value = window.innerWidth < 1024
  }
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})

function toggleUnified() {
  if (isMobile.value) {
    sidebarOpen.value = !sidebarOpen.value
  } else {
    toggleCollapse()
  }
}

const sidebarToggleLabel = computed(() => {
  if (isMobile.value) {
    return sidebarOpen.value ? 'Close navigation menu' : 'Open navigation menu'
  }

  return sidebarCollapsed.value ? 'Expand sidebar' : 'Collapse sidebar'
})

// Color mode cycling: light → dark → system → light
function cycleColorMode() {
  const modes: string[] = ['light', 'dark', 'system']
  const current = colorMode.preference
  const index = modes.indexOf(current)
  colorMode.preference = modes[(index + 1) % modes.length] ?? 'light'
}

const colorModeIcon = computed(() => {
  const pref = colorMode.preference
  if (pref === 'dark') return 'lucide:moon'
  if (pref === 'system') return 'lucide:monitor'
  return 'lucide:sun'
})

const colorModeLabel = computed(() => {
  const pref = colorMode.preference
  if (pref === 'dark') return 'Dark mode'
  if (pref === 'system') return 'System mode'
  return 'Light mode'
})

async function logout() {
  clearToken()
  await navigateTo('/dashboard/login')
}

watch(
  () => route.fullPath,
  () => {
    closeSidebar()
  },
)

watch(isMobile, (mobile) => {
  if (!mobile) {
    sidebarOpen.value = false
  }
})
</script>

<template>
  <div class="sy-dashboard-shell" :class="{ 'is-collapsed': sidebarCollapsed }">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <button
        v-if="sidebarOpen && isMobile"
        type="button"
        class="sy-dashboard-overlay lg:hidden"
        aria-label="Close menu"
        @click="closeSidebar"
      />
    </Transition>

    <aside
      id="dashboard-sidebar"
      class="sy-dashboard-sidebar"
      :class="{ 'is-open': sidebarOpen, 'is-collapsed': sidebarCollapsed }"
    >
      <UTooltip
        text="SyanoLink Dashboard"
        :popper="{ placement: 'right' }"
        :disabled="!sidebarCollapsed"
      >
        <NuxtLink to="/dashboard/links" class="sy-dashboard-brand" @click="closeSidebar">
          <div class="sy-dashboard-brand-mark">
            <UIcon name="lucide:link-2" class="h-4 w-4" />
          </div>
          <div class="sy-dashboard-brand-text">
            <p class="sy-dashboard-brand-title">
              SyanoLink
            </p>
            <p class="sy-dashboard-brand-subtitle">
              Dashboard
            </p>
          </div>
        </NuxtLink>
      </UTooltip>

      <nav class="space-y-2">
        <UTooltip
          v-for="item in navigation"
          :key="item.to"
          :text="item.label"
          :popper="{ placement: 'right' }"
          :disabled="!sidebarCollapsed"
        >
          <NuxtLink
            :to="item.to"
            class="sy-dashboard-nav-link"
            :class="isActive(item.to) ? 'is-active' : ''"
            :title="sidebarCollapsed ? item.label : undefined"
            :aria-label="sidebarCollapsed ? item.label : undefined"
            @click="closeSidebar"
          >
            <UIcon :name="item.icon" class="h-4 w-4 shrink-0" />
            <span class="sy-dashboard-nav-label">{{ item.label }}</span>
          </NuxtLink>
        </UTooltip>
      </nav>

      <div class="mt-auto space-y-2 pt-5">
        <!-- Current user info -->
        <div v-if="user && !sidebarCollapsed" class="sy-sidebar-user-info">
          <div class="sy-sidebar-user-avatar">
            {{ userInitials }}
          </div>
          <div class="sy-sidebar-user-meta">
            <p class="sy-sidebar-user-name">{{ user.displayName || user.username }}</p>
            <p class="sy-sidebar-user-role">{{ user.isRoot ? 'Root Admin' : 'User' }}</p>
          </div>
        </div>

        <UTooltip
          text="Help"
          :popper="{ placement: 'right' }"
          :disabled="!sidebarCollapsed"
        >
          <button
            type="button"
            class="sy-dashboard-nav-link"
            :title="sidebarCollapsed ? 'Help' : undefined"
            :aria-label="sidebarCollapsed ? 'Help' : undefined"
          >
            <UIcon name="lucide:circle-help" class="h-4 w-4 shrink-0" />
            <span class="sy-dashboard-nav-label">Help</span>
          </button>
        </UTooltip>
        <UTooltip
          text="Logout"
          :popper="{ placement: 'right' }"
          :disabled="!sidebarCollapsed"
        >
          <button
            type="button"
            class="sy-dashboard-nav-link"
            :title="sidebarCollapsed ? 'Logout' : undefined"
            :aria-label="sidebarCollapsed ? 'Logout' : undefined"
            @click="logout"
          >
            <UIcon name="lucide:log-out" class="h-4 w-4 shrink-0" />
            <span class="sy-dashboard-nav-label">Logout</span>
          </button>
        </UTooltip>
      </div>


    </aside>

    <div class="sy-dashboard-main">
      <header class="sy-dashboard-topbar">
        <!-- Unified Sidebar Toggle (Top) -->
        <button
          type="button"
          class="sy-topbar-toggle sy-dashboard-icon-button bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-400 dark:border-brand-800"
          :aria-label="sidebarToggleLabel"
          :aria-expanded="isMobile ? sidebarOpen : !sidebarCollapsed"
          aria-controls="dashboard-sidebar"
          @click="toggleUnified"
        >
          <UIcon v-if="isMobile" name="lucide:menu" class="h-5 w-5" />
          <template v-else>
            <UIcon v-if="sidebarCollapsed" name="lucide:chevron-right" class="h-5 w-5" />
            <UIcon v-else name="lucide:chevron-left" class="h-5 w-5" />
          </template>
        </button>

        <DashboardQuickSearch />

        <div class="ml-auto flex items-center gap-2 md:gap-3">
          <UButton to="/dashboard/links/create" size="lg" class="hidden sm:inline-flex">
            + Create Link
          </UButton>
          <UButton
            to="/dashboard/links/create"
            size="md"
            icon="lucide:plus"
            class="sm:hidden"
            aria-label="Create link"
            title="Create link"
          />

          <!-- Color mode toggle -->
          <button
            type="button"
            class="sy-dashboard-icon-button"
            :aria-label="colorModeLabel"
            :title="colorModeLabel"
            @click="cycleColorMode"
          >
            <UIcon :name="colorModeIcon" class="h-5 w-5" />
          </button>

          <button type="button" class="sy-dashboard-avatar" aria-label="Profile">
            <span>{{ userInitials }}</span>
          </button>
        </div>
      </header>

      <main class="sy-dashboard-content">
        <slot />
      </main>
    </div>
  </div>
</template>
