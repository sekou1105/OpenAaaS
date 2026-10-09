<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <div class="mb-6">
      <router-link to="/" class="text-sm text-text-secondary hover:text-text-primary mb-2 inline-flex items-center gap-1">
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        {{ t('guide.back') }}
      </router-link>
      <h1 class="text-2xl font-bold mt-2">{{ t('guide.title') }}</h1>
      <p class="mt-2 text-sm text-text-secondary">{{ t('guide.subtitle') }}</p>
    </div>

    <!-- 快速上手 -->
    <div class="bg-bg-secondary border border-border rounded-lg p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">{{ t('guide.quickTitle') }}</h2>
      <ol class="space-y-4">
        <li class="flex gap-3">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white text-sm font-bold">1</span>
          <div>
            <p class="font-semibold text-sm">{{ t('guide.step1Title') }}</p>
            <p class="text-sm text-text-secondary mt-1">
              {{ t('guide.step1a') }}
              {{ t('guide.step1b') }}<code class="rounded bg-bg-inset border border-border px-1.5 py-0.5 text-xs text-accent">https://openaaas.buaa.edu.cn</code>
            </p>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white text-sm font-bold">2</span>
          <div>
            <p class="font-semibold text-sm">{{ t('guide.step2Title') }}</p>
            <p class="text-sm text-text-secondary mt-1">
              {{ t('guide.step2Text') }}
            </p>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white text-sm font-bold">3</span>
          <div>
            <p class="font-semibold text-sm">{{ t('guide.step3Title') }}</p>
            <p class="text-sm text-text-secondary mt-1">
              {{ t('guide.step3Text') }}
            </p>
          </div>
        </li>
      </ol>
    </div>

    <!-- 任务管理技巧 -->
    <div class="bg-bg-secondary border border-border rounded-lg p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">{{ t('guide.tipsTitle') }}</h2>
      <ul class="space-y-3 text-sm text-text-secondary">
        <li class="flex gap-2">
          <span class="text-accent font-semibold flex-shrink-0">{{ t('guide.tip1Label') }}</span>
          {{ t('guide.tip1Text') }}
        </li>
        <li class="flex gap-2">
          <span class="text-accent font-semibold flex-shrink-0">{{ t('guide.tip2Label') }}</span>
          {{ t('guide.tip2Text') }}
        </li>
        <li class="flex gap-2">
          <span class="text-accent font-semibold flex-shrink-0">{{ t('guide.tip3Label') }}</span>
          {{ t('guide.tip3Text') }}
        </li>
        <li class="flex gap-2">
          <span class="text-accent font-semibold flex-shrink-0">{{ t('guide.tip4Label') }}</span>
          {{ t('guide.tip4Text') }}
        </li>
      </ul>
    </div>

    <!-- 常见问题 -->
    <div class="bg-bg-secondary border border-border rounded-lg p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">{{ t('guide.faqTitle') }}</h2>
      <div class="space-y-4 text-sm">
        <div>
          <p class="font-semibold">{{ t('guide.faq1Q') }}</p>
          <p class="text-text-secondary mt-1">
            {{ t('guide.faq1A') }}
          </p>
        </div>
        <div>
          <p class="font-semibold">{{ t('guide.faq2Q') }}</p>
          <p class="text-text-secondary mt-1">
            {{ t('guide.faq2A') }}
          </p>
        </div>
        <div>
          <p class="font-semibold">{{ t('guide.faq3Q') }}</p>
          <p class="text-text-secondary mt-1">
            {{ t('guide.faq3A') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
