<script setup lang="ts">
definePageMeta({
  middleware: 'dashboard-auth',
})

useHead({
  title: 'Dashboard | Syano',
  meta: [
    { name: 'description', content: 'Manage your shortened links, view analytics, and configure settings.' }
  ],
})

await navigateTo('/dashboard/links', { replace: true })
</script>

<template>
  <div class="p-6 text-sm text-slate-500">
    Redirecting to dashboard...
  </div>
</template>
