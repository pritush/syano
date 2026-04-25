<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { hydrate, isAuthenticated, setAuth } = useAuthToken()

const draftUsername = ref('')
const draftPassword = ref('')
const loading = ref(false)
const errorMessage = ref('')

hydrate()

const redirectTarget = computed(() => {
  const raw = route.query.redirect
  return typeof raw === 'string' && raw.startsWith('/dashboard') ? raw : '/dashboard/links'
})

// If already authenticated, redirect immediately (e.g. user visits /login while logged in)
onMounted(() => {
  if (isAuthenticated.value) {
    navigateTo(redirectTarget.value, { replace: true })
  }
})

async function submit() {
  loading.value = true
  errorMessage.value = ''

  if (!draftUsername.value.trim()) {
    errorMessage.value = 'Username is required.'
    loading.value = false
    return
  }

  if (!draftPassword.value.trim()) {
    errorMessage.value = 'Password is required.'
    loading.value = false
    return
  }

  try {
    const result = await $fetch<{
      token: string
      user: {
        id: string
        username: string
        displayName: string
        permissions: string[]
        isRoot: boolean
      }
    }>('/api/auth/login', {
      method: 'POST',
      body: {
        username: draftUsername.value.trim(),
        password: draftPassword.value.trim(),
      },
    })

    // Set credentials in state + localStorage
    setAuth(result.token, result.user)

    // Hard navigation ensures clean hydration — avoids stale SSR state
    // from racing with reactive watchers or middleware re-checks
    if (import.meta.client) {
      window.location.href = redirectTarget.value
    }
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Invalid username or password.'
    loading.value = false
  }
}
</script>

<template>
  <UContainer class="flex min-h-screen items-center justify-center px-6 py-16">
    <div class="grid w-full max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <UCard class="sy-surface rounded-[32px] border-0">
        <template #header>
          <UBadge color="primary" variant="soft" class="rounded-full px-4 py-2">
            Dashboard access
          </UBadge>
        </template>

        <div class="space-y-5">
          <h1 class="text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Sign in to your dashboard.
          </h1>
          <p class="text-base leading-7 text-slate-600 dark:text-slate-400">
            Enter your username and password to access the Syano admin dashboard.
          </p>

        </div>
      </UCard>

      <UCard class="sy-surface rounded-[32px] border-0">
        <template #header>
          <div class="space-y-1">
            <p class="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Login
            </p>
            <h2 class="text-2xl font-semibold text-slate-950 dark:text-slate-50">
              Enter credentials
            </h2>
          </div>
        </template>

        <form class="space-y-5" @submit.prevent="submit">
          <UFormField label="Username">
            <UInput
              v-model="draftUsername"
              type="text"
              size="xl"
              placeholder="Enter your username"
              autocomplete="username"
            />
          </UFormField>

          <UFormField label="Password">
            <UInput
              v-model="draftPassword"
              type="password"
              size="xl"
              placeholder="Enter your password"
              autocomplete="current-password"
            />
          </UFormField>

          <p v-if="errorMessage" class="rounded-2xl bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700 dark:bg-accent-950 dark:text-accent-300">
            {{ errorMessage }}
          </p>

          <div class="flex flex-wrap gap-3">
            <UButton type="submit" size="xl" :loading="loading">
              Sign in
            </UButton>
            <UButton to="/" color="neutral" variant="soft" size="xl">
              Back to homepage
            </UButton>
          </div>
        </form>
      </UCard>
    </div>
  </UContainer>
</template>
