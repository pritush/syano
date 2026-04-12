<script setup lang="ts">
const props = defineProps<{
  redirectUrl: string
}>()

const countdown = ref(3)
const destination = computed(() => props.redirectUrl || '/')
const progress = computed(() => `${((3 - countdown.value) / 3) * 100}%`)
let timer: number | null = null

onMounted(() => {
  timer = window.setInterval(() => {
    if (countdown.value <= 1) {
      if (timer !== null) {
        window.clearInterval(timer)
      }

      window.location.href = destination.value
      return
    }

    countdown.value -= 1
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer !== null) {
    window.clearInterval(timer)
  }
})
</script>

<template>
  <UContainer class="flex min-h-screen items-center justify-center px-6 py-16">
    <UCard class="sy-surface sy-hero-grid w-full max-w-2xl rounded-[36px] border-0 overflow-hidden">
      <div class="space-y-8 text-center">
        <div class="mx-auto inline-flex rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-700 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          Homepage redirect
        </div>

        <div class="space-y-4">
          <p class="text-sm font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Redirecting in
          </p>
          <div class="text-7xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {{ countdown }}
          </div>
          <p class="mx-auto max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
            The homepage is configured to forward visitors to
            <span class="font-semibold text-brand-700 dark:text-brand-400">{{ destination }}</span>
            after a short pause.
          </p>
        </div>

        <div class="mx-auto h-3 w-full max-w-lg overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            class="h-full rounded-full bg-brand-500 transition-all duration-700 ease-out dark:bg-brand-400"
            :style="{ width: progress }"
          />
        </div>

        <div class="flex flex-wrap items-center justify-center gap-3">
          <a
            :href="destination"
            class="inline-flex items-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-950/15 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            Continue now
          </a>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
