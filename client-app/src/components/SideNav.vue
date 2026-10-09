<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ClipboardList, Languages, Settings, Store } from '@lucide/vue'
import { useTaskStore } from '@/stores/task'
import { useUiStore } from '@/stores/ui'
import { toggleLocale } from '@/i18n'
const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()
const uiStore = useUiStore()
const { t, locale } = useI18n()

const navItems = computed(() => [
  { name: 'home', label: t('nav.home'), icon: Store },
  { name: 'tasks', label: t('nav.tasks'), icon: ClipboardList },
  { name: 'settings', label: t('nav.settings'), icon: Settings },
])

const langLabel = computed(() => (locale.value === 'zh-CN' ? 'EN' : '中'))

const activeTab = computed(() => {
  if (route.path === '/') return 'home'
  if (route.path.startsWith('/task')) return 'tasks'
  if (route.path.startsWith('/settings')) return 'settings'
  return ''
})

const activeTaskCount = computed(() => taskStore.activeTaskCount)

function navigateTo(name: string) {
  uiStore.setCurrentTab(name)
  if (name === 'home') router.push('/')
  else if (name === 'tasks') router.push('/tasks')
  else if (name === 'settings') router.push('/settings')
}

function isActive(name: string): boolean {
  return activeTab.value === name
}
</script>

<template>
  <nav class="w-[76px] flex-shrink-0 bg-bg-secondary border-r border-border flex flex-col items-center py-4 z-20">
    <!-- Logo -->
    <button
      class="brand-logo mb-6 select-none"
      type="button"
      title="OpenAaaS"
      :aria-label="t('nav.backHome')"
      @click="navigateTo('home')"
    >
      <img src="/logo-mark-blue.png" alt="" class="w-11 h-auto" aria-hidden="true" />
    </button>

    <!-- Nav Items -->
    <div class="flex flex-col gap-2 flex-1 w-full px-2.5">
      <button
        v-for="item in navItems"
        :key="item.name"
        type="button"
        :title="item.label"
        class="group relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg border border-transparent px-1.5 py-2 text-text-secondary transition-all hover:border-border hover:bg-bg-primary hover:text-text-primary hover:shadow-sm"
        :class="{
          'border-accent/25 bg-accent-soft text-accent shadow-sm': isActive(item.name),
        }"
        @click="navigateTo(item.name)"
      >
        <component
          :is="item.icon"
          class="h-5 w-5"
          :stroke-width="isActive(item.name) ? 2.35 : 2"
          aria-hidden="true"
        />
        <span class="text-[10px] font-semibold leading-none">{{ item.label }}</span>
        <!-- Red badge for active tasks on task list icon -->
        <span
          v-if="item.name === 'tasks' && activeTaskCount > 0"
          class="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm"
        >
          {{ activeTaskCount }}
        </span>
      </button>
    </div>

    <!-- Language Switch -->
    <button
      type="button"
      :title="t('nav.switchLang')"
      class="mt-2 flex min-h-[44px] w-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent text-text-secondary transition-all hover:border-border hover:bg-bg-primary hover:text-text-primary hover:shadow-sm"
      @click="toggleLocale()"
    >
      <Languages class="h-5 w-5" :stroke-width="2" aria-hidden="true" />
      <span class="text-[10px] font-semibold leading-none">{{ langLabel }}</span>
    </button>
  </nav>
</template>

<style scoped>
.brand-logo {
  align-items: center;
  background: linear-gradient(180deg, #ffffff 0%, #f4faff 100%);
  border: 1px solid #d8e0e7;
  border-radius: 14px;
  box-shadow: 0 8px 20px rgba(30, 144, 255, 0.1);
  display: flex;
  height: 48px;
  justify-content: center;
  overflow: hidden;
  position: relative;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  width: 48px;
}

.brand-logo:hover {
  border-color: rgba(30, 144, 255, 0.45);
  box-shadow: 0 12px 26px rgba(30, 144, 255, 0.16);
  transform: translateY(-1px);
}
</style>
