<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowRight, Gauge, LockKeyhole, Server, Sparkles } from '@lucide/vue'
import type { ServiceItem } from '@/stores/server'
import StatusBadge from '@/components/StatusBadge.vue'
import Skeleton from '@/components/Skeleton.vue'
import { localizedServiceName, localizedServiceDescription } from '@/i18n/serviceEn'

interface ServiceLoad {
  capacity?: number
  current_load?: number
  available_slots?: number
  pending_tasks?: number
  running_tasks?: number
}

const props = defineProps<{
  service: ServiceItem
  load?: ServiceLoad | null
  demo?: boolean
}>()

const emit = defineEmits<{
  open: [serviceId: string]
}>()

const { t } = useI18n()

const displayName = computed(() => localizedServiceName(props.service.id, props.service.name))
const displayDescription = computed(() => localizedServiceDescription(props.service.id, props.service.description ?? ''))

const statusMeta = computed(() => {
  const map = {
    online: { label: 'ONLINE', tone: 'success' as const },
    offline: { label: 'OFFLINE', tone: 'secondary' as const },
    busy: { label: 'BUSY', tone: 'warning' as const },
  }
  return map[props.service.agentStatus] ?? { label: props.service.agentStatus, tone: 'neutral' as const }
})

const accessMeta = computed(() => {
  if (props.service.accessType === 'public') return { label: t('serviceCard.public'), tone: 'accent' as const }
  return { label: t('serviceCard.restricted'), tone: 'info' as const }
})

const loadMetrics = computed(() => {
  if (!props.load) return []
  return [
    { label: t('serviceCard.capacity'), value: props.load.capacity },
    { label: t('serviceCard.load'), value: props.load.current_load },
    { label: t('serviceCard.available'), value: props.load.available_slots },
    { label: t('serviceCard.queued'), value: props.load.pending_tasks },
    { label: t('serviceCard.running'), value: props.load.running_tasks },
  ].filter((item) => item.value != null)
})
</script>

<template>
  <button
    type="button"
    class="group flex min-h-[196px] w-full flex-col rounded-lg border border-border bg-bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-soft focus-visible:shadow-focus"
    :class="{
      'border-secondary/30 bg-secondary-soft/60': !service.hasPermission,
      'cursor-default hover:translate-y-0': demo,
    }"
    @click="emit('open', service.id)"
  >
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-3">
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border"
          :class="service.hasPermission
            ? 'border-accent/20 bg-accent-soft text-accent'
            : 'border-secondary/25 bg-bg-card text-secondary'"
        >
          <Sparkles v-if="service.hasPermission" class="h-5 w-5" :stroke-width="2.25" aria-hidden="true" />
          <LockKeyhole v-else class="h-5 w-5" :stroke-width="2.25" aria-hidden="true" />
        </div>
        <div class="min-w-0">
          <h3 class="truncate text-base font-bold text-info">{{ displayName }}</h3>
          <div class="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusBadge v-if="demo" :label="t('serviceCard.demo')" tone="neutral" compact />
            <StatusBadge :label="accessMeta.label" :tone="accessMeta.tone" compact />
            <StatusBadge
              v-if="!service.hasPermission"
              :label="t('serviceCard.noPermission')"
              tone="secondary"
              compact
              show-icon
            />
          </div>
        </div>
      </div>
      <StatusBadge :label="statusMeta.label" :tone="statusMeta.tone" compact />
    </div>

    <p class="mb-4 min-h-[42px] text-sm leading-6 text-text-secondary line-clamp-2">
      {{ displayDescription || t('serviceCard.noDescription') }}
    </p>

    <div v-if="loadMetrics.length > 0" class="mt-auto grid grid-cols-3 gap-2">
      <div
        v-for="metric in loadMetrics.slice(0, 3)"
        :key="metric.label"
        class="rounded-lg border border-border bg-bg-inset px-2 py-2"
      >
        <p class="text-[10px] font-semibold text-text-muted">{{ metric.label }}</p>
        <p class="mt-1 text-sm font-bold text-text-primary">{{ metric.value }}</p>
      </div>
    </div>
    <div v-else-if="load === null" class="mt-auto flex items-center gap-2 rounded-lg border border-secondary/20 bg-secondary-soft px-3 py-2 text-xs font-semibold text-secondary">
      <Gauge class="h-4 w-4" aria-hidden="true" />
      {{ t('serviceCard.loadUnavailable') }}
    </div>
    <div v-else-if="service.hasPermission" class="mt-auto space-y-2 rounded-lg border border-border bg-bg-inset px-3 py-3">
      <Skeleton height="12px" width="72%" />
      <Skeleton height="12px" width="52%" />
    </div>
    <div v-else class="mt-auto flex items-center gap-2 rounded-lg border border-border bg-bg-card px-3 py-2 text-xs font-medium text-text-muted">
      <Server class="h-4 w-4" aria-hidden="true" />
      {{ t('serviceCard.authRequiredForLoad') }}
    </div>

    <div class="mt-4 flex items-center justify-end border-t border-border pt-3 text-xs font-semibold text-text-muted">
      <span
        v-if="!demo"
        class="inline-flex items-center gap-1 text-accent opacity-75 transition-opacity group-hover:opacity-100"
      >
        {{ t('serviceCard.viewDetail') }}
        <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span v-else class="text-text-muted">{{ t('serviceCard.visualPreview') }}</span>
    </div>
  </button>
</template>
