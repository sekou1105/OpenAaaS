<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useServerStore } from '@/stores/server'
import { httpFetch } from '@/composables/useHttp'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import Skeleton from '@/components/Skeleton.vue'
import { formatUsageMarkdown } from '@/utils/usageFormat'
import { localizedServiceName, localizedServiceDescription, localizedServiceUsage } from '@/i18n/serviceEn'

const route = useRoute()
const serverStore = useServerStore()
const { t } = useI18n()

const serviceId = computed(() => String(route.params.id))
const service = computed(() => {
  for (const cache of Object.values(serverStore.services)) {
    const found = cache.items.find((s) => s.id === serviceId.value)
    if (found) return found
  }
  return undefined
})

const load = ref<{
  capacity?: number
  current_load?: number
  available_slots?: number
  pending_tasks?: number
  running_tasks?: number
} | null | undefined>(undefined)

const usage = ref<string | null | undefined>(undefined)
const displayName = computed(() => service.value ? localizedServiceName(service.value.id, service.value.name) : '')
const displayDescription = computed(() => service.value ? localizedServiceDescription(service.value.id, service.value.description ?? '') : '')
const usageHtml = computed(() => {
  if (!usage.value) return ''
  const localized = localizedServiceUsage(serviceId.value, usage.value)
  const html = marked.parse(formatUsageMarkdown(localized), { async: false, breaks: true }) as string
  return DOMPurify.sanitize(html)
})

async function fetchServiceData() {
  if (!serviceId.value) return
  const server = serverStore.defaultServer
  if (!server?.apiKey) return
  const baseUrl = server.serverUrl.replace(/\/$/, '')

  try {
    const loadUrl = `${baseUrl}/api/v1/client/services/${encodeURIComponent(serviceId.value)}/load`
    const loadRes = await httpFetch(loadUrl, {
      headers: { Authorization: `Bearer ${server.apiKey}` },
    })
    if (loadRes.ok) {
      load.value = await loadRes.json()
    } else {
      load.value = null
    }
  } catch {
    load.value = null
  }

  try {
    const usageUrl = `${baseUrl}/api/v1/client/services/${encodeURIComponent(serviceId.value)}/usage`
    const usageRes = await httpFetch(usageUrl, {
      headers: { Authorization: `Bearer ${server.apiKey}` },
    })
    if (usageRes.ok) {
      const data = await usageRes.json()
      usage.value = data.usage ?? null
    } else {
      usage.value = null
    }
  } catch {
    usage.value = null
  }
}

onMounted(() => {
  fetchServiceData()

  const server = serverStore.defaultServer
  if (server?.apiKey) {
    serverStore.fetchServices().catch((err) => {
      console.warn('刷新服务列表失败', err)
    })
  }
})

watch(() => route.params.id, () => {
  load.value = undefined
  usage.value = undefined
  fetchServiceData()
  serverStore.fetchServices().catch((err) => {
    console.warn('刷新服务列表失败', err)
  })
})
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <div class="mb-6">
      <router-link to="/" class="text-sm text-text-secondary hover:text-text-primary mb-2 inline-block">
        {{ t('serviceDetail.back') }}
      </router-link>
      <h1 class="text-2xl font-bold mt-2">{{ t('serviceDetail.title') }}</h1>
    </div>

    <div v-if="service" class="bg-bg-secondary border border-border rounded-lg p-6">
      <div class="flex items-start justify-between mb-4">
        <h2 class="text-xl font-semibold">{{ displayName }}</h2>
        <span
          class="text-[11px] font-semibold px-2 py-1 rounded-full uppercase"
          :class="{
            'bg-success/10 text-success': service.agentStatus === 'online',
            'bg-danger/10 text-danger': service.agentStatus === 'offline',
            'bg-warning/10 text-warning': service.agentStatus === 'busy',
          }"
        >
          {{ service.agentStatus }}
        </span>
      </div>
      <p class="text-text-secondary mb-4">{{ displayDescription || t('serviceDetail.noDescription') }}</p>

      <div class="flex items-center gap-3 mb-6">
        <span
          class="text-xs px-2 py-1 rounded border"
          :class="service.accessType === 'public'
            ? 'border-success/30 text-success'
            : 'border-warning/30 text-warning'"
        >
          {{ service.accessType === 'public' ? t('serviceDetail.publicAccess') : t('serviceDetail.authRequired') }}
        </span>
      </div>

      <div v-if="load !== undefined && load !== null" class="mt-4 p-3 bg-bg-primary border border-border rounded-md">
        <p class="text-sm font-medium mb-1">{{ t('serviceDetail.loadInfo') }}</p>
        <div class="flex flex-wrap gap-3 text-xs text-text-muted">
          <span v-if="load.capacity != null">{{ t('serviceDetail.capacity') }} {{ load.capacity }}</span>
          <span v-if="load.current_load != null">{{ t('serviceDetail.currentLoad') }} {{ load.current_load }}</span>
          <span v-if="load.available_slots != null">{{ t('serviceDetail.availableSlots') }} {{ load.available_slots }}</span>
          <span v-if="load.pending_tasks != null">{{ t('serviceDetail.pendingTasks') }} {{ load.pending_tasks }}</span>
          <span v-if="load.running_tasks != null">{{ t('serviceDetail.runningTasks') }} {{ load.running_tasks }}</span>
        </div>
      </div>
      <div v-else-if="load === null" class="mt-4 p-3 bg-bg-primary border border-border rounded-md">
        <p class="text-sm font-medium mb-1">{{ t('serviceDetail.loadInfo') }}</p>
        <p class="text-xs text-danger">{{ t('serviceDetail.fetchFailed') }}</p>
      </div>
      <div v-else class="mt-4 p-3 bg-bg-primary border border-border rounded-md space-y-2">
        <p class="text-sm font-medium mb-1">{{ t('serviceDetail.loadInfo') }}</p>
        <Skeleton :rows="3" height="14px" />
      </div>

      <div v-if="usage !== undefined && usage !== null" class="mt-4 p-3 bg-bg-primary border border-border rounded-md">
        <p class="text-sm font-medium mb-1">{{ t('serviceDetail.usage') }}</p>
        <div class="text-sm leading-relaxed prose prose-sm max-w-none prose-table:border prose-th:bg-bg-secondary prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5" v-html="usageHtml" />
      </div>
      <div v-else-if="usage === null" class="mt-4 p-3 bg-bg-primary border border-border rounded-md">
        <p class="text-sm font-medium mb-1">{{ t('serviceDetail.usage') }}</p>
        <p class="text-xs text-danger">{{ t('serviceDetail.fetchFailed') }}</p>
      </div>
      <div v-else class="mt-4 p-3 bg-bg-primary border border-border rounded-md space-y-2">
        <p class="text-sm font-medium mb-1">{{ t('serviceDetail.usage') }}</p>
        <Skeleton :rows="8" height="14px" />
      </div>

      <router-link
        v-if="service.hasPermission"
        :to="`/submit/${service.id}`"
        class="inline-flex items-center px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors mt-4"
      >
        {{ t('serviceDetail.submitTask') }}
      </router-link>
      <span v-else class="text-sm text-danger mt-4 inline-block">{{ t('serviceDetail.noPermission') }}</span>
    </div>

    <div v-else class="text-text-muted">
      {{ t('serviceDetail.notFound') }}
    </div>
  </div>
</template>
