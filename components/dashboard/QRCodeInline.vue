<script setup lang="ts">
const props = defineProps<{
  slug: string
  size?: number
}>()

const displaySize = computed(() => props.size || 120)
const loading = ref(false)
const error = ref(false)
const svgContent = ref('')

async function fetchQR() {
  if (!props.slug) return

  loading.value = true
  error.value = false
  svgContent.value = ''

  try {
    const response = await $fetch<string>(`/api/qr/${props.slug}?format=svg`, {
      responseType: 'text',
    })
    svgContent.value = response
  } catch (err) {
    console.error('QR inline fetch error:', err)
    error.value = true
  } finally {
    loading.value = false
  }
}

watch(() => props.slug, (newSlug) => {
  if (newSlug) {
    fetchQR()
  }
}, { immediate: true })
</script>

<template>
  <div
    class="qr-inline-preview"
    :style="{ width: `${displaySize}px`, height: `${displaySize}px` }"
  >
    <!-- Loading -->
    <div v-if="loading" class="flex h-full w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex h-full w-full cursor-pointer items-center justify-center rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20" @click="fetchQR">
      <UIcon name="lucide:refresh-cw" class="h-5 w-5 text-red-400" />
    </div>

    <!-- QR SVG -->
    <div
      v-else-if="svgContent"
      class="qr-inline-svg h-full w-full overflow-hidden rounded-xl border-2 border-slate-200 bg-white p-1 dark:border-slate-600"
      v-html="svgContent"
    />
  </div>
</template>

<style scoped>
.qr-inline-svg :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
