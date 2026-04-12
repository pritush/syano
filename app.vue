<template>
  <UApp :toaster="null">
    <NuxtLoadingIndicator color="var(--color-brand-500)" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <UToaster />
  </UApp>
</template>
