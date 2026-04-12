<script setup lang="ts">
const route = useRoute()
const { hydrate, isAuthenticated, setToken, setUsername, token } = useAuthToken()

const draftUsername = ref('')
const draftToken = ref('')
const loading = ref(false)
const errorMessage = ref('')

hydrate()
draftToken.value = token.value

const redirectTarget = computed(() => {
  const raw = route.query.redirect
  return typeof raw === 'string' && raw.startsWith('/dashboard') ? raw : '/dashboard/links'
})

watchEffect(async () => {
  if (isAuthenticated.value) {
    await navigateTo(redirectTarget.value, { replace: true })
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

  if (!draftToken.value.trim()) {
    errorMessage.value = 'Token is required.'
    loading.value = false
    return
  }

  try {
    await $fetch('/api/link/list', {
      query: { limit: 1 },
      headers: {
        authorization: `Bearer ${draftToken.value.trim()}`,
        'x-site-user': draftUsername.value.trim(),
      },
    })

    // Set credentials immediately
    setToken(draftToken.value)
    setUsername(draftUsername.value)
    
    // Navigate without waiting for loading state to finish
    navigateTo(redirectTarget.value, { replace: true })
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Invalid username or token.'
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
            Authenticate with your credentials.
          </h1>
          <p class="text-base leading-7 text-slate-600 dark:text-slate-400">
            Syano keeps admin authentication intentionally simple, credentials can be changed or set via .env file.
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
          <UFormField label="Username" description="The username set in NUXT_SITE_USER environment variable.">
            <UInput
              v-model="draftUsername"
              type="text"
              size="xl"
              placeholder="Enter your username"
              autocomplete="username"
            />
          </UFormField>

          <UFormField label="Site token" description="The same token expected by the Authorization bearer header.">
            <UInput
              v-model="draftToken"
              type="password"
              size="xl"
              placeholder="Paste your site token"
              autocomplete="current-password"
            />
          </UFormField>

          <p v-if="errorMessage" class="rounded-2xl bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700 dark:bg-accent-950 dark:text-accent-300">
            {{ errorMessage }}
          </p>

          <div class="flex flex-wrap gap-3">
            <UButton type="submit" size="xl" :loading="loading">
              Unlock dashboard
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
