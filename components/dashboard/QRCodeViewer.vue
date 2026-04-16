<script setup lang="ts">
const props = defineProps<{
  slug: string
  modelValue?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.modelValue ?? false,
  set: (value) => emit('update:modelValue', value),
})

const downloadFormat = ref<'svg' | 'png'>('svg')
const loading = ref(false)
const error = ref('')
const downloading = ref(false)
const svgContent = ref('')

// Fetch SVG content when modal opens or slug changes
async function fetchQR() {
  if (!props.slug) return

  loading.value = true
  error.value = ''
  svgContent.value = ''

  try {
    const response = await $fetch<string>(`/api/qr/${props.slug}?format=svg`, {
      responseType: 'text',
    })
    svgContent.value = response
  } catch (err) {
    console.error('QR fetch error:', err)
    error.value = 'Failed to load QR code'
  } finally {
    loading.value = false
  }
}

// Watch for open state changes to fetch QR
watch(isOpen, (open) => {
  if (open && props.slug) {
    fetchQR()
  }
})

// Watch slug changes while modal is open
watch(() => props.slug, (newSlug) => {
  if (isOpen.value && newSlug) {
    fetchQR()
  }
})

// Download QR code
async function downloadQR() {
  if (!props.slug || !svgContent.value) return

  downloading.value = true

  try {
    if (downloadFormat.value === 'svg') {
      const blob = new Blob([svgContent.value], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${props.slug}-qr.svg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } else {
      // Convert SVG to PNG via canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()
      const svgBlob = new Blob([svgContent.value], { type: 'image/svg+xml' })
      const svgUrl = URL.createObjectURL(svgBlob)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          canvas.width = 1024
          canvas.height = 1024
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(svgUrl)

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create PNG'))
              return
            }
            const pngUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = pngUrl
            link.download = `${props.slug}-qr.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(pngUrl)
            resolve()
          }, 'image/png')
        }
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl)
          reject(new Error('Failed to load SVG for conversion'))
        }
        img.src = svgUrl
      })
    }
  } catch (err) {
    console.error('Download error:', err)
    error.value = 'Failed to download QR code'
  } finally {
    downloading.value = false
  }
}



function retry() {
  error.value = ''
  fetchQR()
}

function handleClose() {
  isOpen.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        @click.self="handleClose"
      >
        <div
          class="relative w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-700">
            <div>
              <h3 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
                QR Code
              </h3>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                /{{ slug }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              aria-label="Close"
              @click="handleClose"
            >
              <UIcon name="lucide:x" class="h-5 w-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="space-y-5 p-6">
            <!-- QR Display -->
            <div class="qr-display-container flex min-h-[280px] items-center justify-center rounded-2xl border-2 border-slate-200 bg-white p-6 dark:border-slate-700">
              <!-- Loading State -->
              <div v-if="loading" class="text-center">
                <div class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-500" />
                <p class="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">Generating QR code…</p>
              </div>

              <!-- Error State -->
              <div v-else-if="error" class="text-center">
                <UIcon name="lucide:alert-circle" class="mx-auto h-10 w-10 text-red-500" />
                <p class="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">{{ error }}</p>
                <button
                  type="button"
                  class="mt-3 text-sm font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400"
                  @click="retry"
                >
                  Retry
                </button>
              </div>

              <!-- QR Code SVG (rendered inline) -->
              <div
                v-else-if="svgContent"
                class="qr-code-svg"
                v-html="svgContent"
              />

              <!-- Empty State -->
              <div v-else class="text-center">
                <UIcon name="lucide:qr-code" class="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p class="mt-3 text-sm text-slate-400 dark:text-slate-500">QR code will appear here</p>
              </div>
            </div>

            <!-- Info Banner -->
            <div class="rounded-xl bg-brand-50 px-4 py-3 dark:bg-brand-950/30">
              <div class="flex items-start gap-3">
                <UIcon name="lucide:info" class="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                <div class="text-sm">
                  <p class="font-semibold text-brand-800 dark:text-brand-300">Tracking enabled</p>

                </div>
              </div>
            </div>

            <!-- Format Selector -->
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Download format
              </label>
              <div class="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition"
                  :class="downloadFormat === 'svg'
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/50 dark:text-brand-400'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-100'"
                  @click="downloadFormat = 'svg'"
                >
                  <UIcon name="lucide:file-code" class="h-4 w-4" />
                  SVG
                </button>
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition"
                  :class="downloadFormat === 'png'
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/50 dark:text-brand-400'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-100'"
                  @click="downloadFormat = 'png'"
                >
                  <UIcon name="lucide:image" class="h-4 w-4" />
                  PNG
                </button>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex">
              <UButton
                block
                size="xl"
                class="w-full text-white bg-slate-900 hover:bg-slate-800 dark:bg-brand-500 dark:text-slate-900 dark:hover:bg-brand-400"
                :loading="downloading"
                :disabled="!!error || loading || !svgContent"
                @click="downloadQR"
              >
                <UIcon name="lucide:download" class="h-5 w-5" />
                Download {{ downloadFormat.toUpperCase() }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.qr-code-svg {
  width: 240px;
  height: 240px;
}

.qr-code-svg :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
