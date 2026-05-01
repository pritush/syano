<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: 'API Documentation — Syano',
})

const { token } = useAuthToken()

// Build the URL to the server-rendered Scalar page, passing the JWT token
const scalarUrl = computed(() => {
  if (!token.value) return ''
  return `/api/scalar?token=${encodeURIComponent(token.value)}`
})

const loading = ref(true)

function onIframeLoad() {
  loading.value = false
}
</script>

<template>
  <div class="sy-api-docs-page">
    <div class="sy-api-docs-header">
      <h1 class="sy-api-docs-title">
        <UIcon name="lucide:book-open" class="h-5 w-5" />
        API Documentation
      </h1>
      <p class="sy-api-docs-subtitle">
        Interactive API reference for SyanoLink — explore endpoints, authenticate, and test live requests.
      </p>
    </div>

    <div class="sy-api-docs-frame-wrap">
      <!-- Loading state -->
      <div v-if="loading" class="sy-api-docs-loading">
        <div class="sy-api-docs-spinner" />
        <p>Loading API Reference…</p>
      </div>

      <!-- Scalar UI served by Nitro at /api/scalar -->
      <iframe
        v-if="scalarUrl"
        :key="scalarUrl"
        :src="scalarUrl"
        class="sy-api-docs-frame"
        title="API Reference"
        @load="onIframeLoad"
      />

      <!-- Fallback if no token -->
      <div v-else class="sy-api-docs-empty">
        <UIcon name="lucide:lock" class="h-8 w-8 opacity-40" />
        <p>Please log in to view API documentation.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sy-api-docs-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--topbar-height, 64px));
  overflow: hidden;
}

.sy-api-docs-header {
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid var(--ui-border, rgba(0,0,0,0.08));
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dark .sy-api-docs-header {
  border-bottom-color: rgba(255,255,255,0.08);
}

.sy-api-docs-title {
  font-size: 1.125rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ui-text, #111);
  margin: 0;
}

.dark .sy-api-docs-title {
  color: #f1f5f9;
}

.sy-api-docs-subtitle {
  font-size: 0.8125rem;
  color: var(--ui-text-muted, #64748b);
  margin: 0;
}

.sy-api-docs-frame-wrap {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.sy-api-docs-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
  background: transparent;
}

.sy-api-docs-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--ui-text-muted, #64748b);
  font-size: 0.875rem;
  z-index: 1;
}

.sy-api-docs-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(0,0,0,0.1);
  border-top-color: var(--ui-primary, #14b8a6);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.dark .sy-api-docs-spinner {
  border-color: rgba(255,255,255,0.1);
  border-top-color: var(--ui-primary, #14b8a6);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.sy-api-docs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  color: var(--ui-text-muted, #64748b);
  font-size: 0.875rem;
}
</style>
