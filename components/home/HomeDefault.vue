<template>
  <UContainer class="flex min-h-screen items-center px-6 py-16">
    <div class="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <div class="space-y-6">
        <UBadge color="primary" variant="soft" class="rounded-full px-4 py-2">
          Self-hosted short links
        </UBadge>
        <div class="space-y-4">
          <h1 class="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl">
            Own your short links, homepage modes, and redirect rules.
          </h1>
          <p class="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Syano is a self-hosted URL shortner & link management tool. The package comes with dashboards, analytics and homepage settings.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <UButton to="/dashboard" size="xl">
            Open dashboard
          </UButton>
        </div>

        <div class="pt-4">
          <a href="https://www.producthunt.com/products/syano-opensource-url-shortener?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-syano-opensource-url-shortener" target="_blank" rel="noopener noreferrer">
            <img alt="Syano - Opensource URL shortener - url shortener, link shortener, bitly alternative | Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1121910&theme=light&t=1776003459663">
          </a>
        </div>
      </div>

      <UCard class="sy-surface sy-hero-grid rounded-[32px] border-0">
        <template #header>
          <div class="flex items-center gap-2">
            <span class="h-3 w-3 rounded-full bg-accent-400" />
            <span class="h-3 w-3 rounded-full bg-amber-400" />
            <span class="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
        </template>

        <div class="space-y-4">
          <div class="rounded-[24px] bg-slate-950 px-5 py-4 text-sm font-medium text-white dark:bg-slate-800">
            https://syano.local/launch
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-[24px] bg-brand-50 p-5 dark:bg-brand-900/30">
              <p class="text-sm font-medium text-brand-700 dark:text-brand-400">
                Redirect engine
              </p>
              <p class="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                Ready
              </p>
            </div>
            <div class="rounded-[24px] bg-white p-5 ring ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
              <p class="text-sm font-medium text-slate-500 dark:text-slate-400">
                Dashboard
              </p>
              <p class="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                Live
              </p>
            </div>
          </div>
          <div class="rounded-[24px] border border-dashed border-brand-300 p-5 dark:border-brand-700">
            <p class="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Switch the homepage between landing, redirect, and bio modes from the dashboard settings page.
            </p>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
