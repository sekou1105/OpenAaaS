<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useServerStore } from '@/stores/server'
import { useTaskStore } from '@/stores/task'
import { useUiStore } from '@/stores/ui'
import { friendlyErrorMessage } from '@/utils/error'
import { localizedServiceName, localizedServiceDescription } from '@/i18n/serviceEn'

const route = useRoute()
const router = useRouter()
const serverStore = useServerStore()
const taskStore = useTaskStore()
const uiStore = useUiStore()
const { t } = useI18n()

const serviceId = computed(() => String(route.params.serviceId))
const service = computed(() => {
  for (const cache of Object.values(serverStore.services)) {
    const found = cache.items.find((s) => s.id === serviceId.value)
    if (found) return found
  }
  return undefined
})

/** 展示用名称/描述（英文环境命中映射时显示英文）；提交给服务端的仍为原始数据 */
const displayServiceName = computed(() => service.value ? localizedServiceName(service.value.id, service.value.name) : '')
const displayServiceDesc = computed(() => service.value ? localizedServiceDescription(service.value.id, service.value.description ?? '') : '')

function queryString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

const title = ref(queryString(route.query.title))
const taskPrompt = ref(queryString(route.query.taskPrompt))
const outputPrompt = ref(queryString(route.query.outputPrompt))
/** 追问任务：携带上一任务的 sessionId，服务端透传给 Agent 以复用上下文 */
const sessionId = queryString(route.query.sessionId) || undefined
const files = ref<FileList | null>(null)
const step = ref(1)
const dragOver = ref(false)
const isLoadingService = ref(false)
const serviceLoadError = ref<string | null>(null)

function handleDrop(event: DragEvent) {
  dragOver.value = false
  if (event.dataTransfer?.files) {
    files.value = event.dataTransfer.files
  }
}

async function submit() {
  if (!service.value) {
    uiStore.addToast(t('submit.toastServiceMissing'), 'error')
    return
  }
  if (!serverStore.defaultServer) {
    uiStore.addToast(t('submit.toastNoDefaultServer'), 'error')
    return
  }
  try {
    uiStore.setLoading(true)
    const taskId = await taskStore.submitTask({
      serverAlias: serverStore.defaultServer.alias,
      serviceId: serviceId.value,
      serviceName: service.value.name,
      // 标题与默认输出要求属于提交给服务端的业务数据，保持原文不做国际化
      title: title.value || '未命名任务',
      taskPrompt: taskPrompt.value,
      outputPrompt: outputPrompt.value.trim() || '将结果写入response.md',
      files: files.value ? Array.from(files.value) : undefined,
      sessionId,
    })
    uiStore.addToast(t('submit.toastSubmitSuccess'), 'success')
    router.push(`/task/${taskId}`)
  } catch (err) {
    const msg = err instanceof Error ? friendlyErrorMessage(err.message) : friendlyErrorMessage(String(err))
    uiStore.addToast(msg, 'error')
  } finally {
    uiStore.setLoading(false)
  }
}

function nextStep() {
  if (step.value === 1) {
    if (!taskPrompt.value.trim()) {
      uiStore.addToast(t('submit.toastPromptRequired'), 'error')
      return
    }
  }
  if (step.value < 2) step.value++
}

function prevStep() {
  if (step.value > 1) step.value--
}

onMounted(async () => {
  if (!service.value) {
    isLoadingService.value = true
    serviceLoadError.value = null
    try {
      await serverStore.fetchServices()
      if (!service.value) {
        serviceLoadError.value = t('submit.serviceNotFound')
      }
    } catch (err) {
      const msg = err instanceof Error ? friendlyErrorMessage(err.message) : friendlyErrorMessage(String(err))
      serviceLoadError.value = msg
    } finally {
      isLoadingService.value = false
    }
  }
})
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <div class="mb-6">
      <router-link
        :to="`/service/${serviceId}`"
        class="text-sm text-text-secondary hover:text-text-primary mb-2 inline-block"
      >
        {{ t('submit.back') }}
      </router-link>
      <h1 class="text-2xl font-bold mt-2">{{ t('submit.title') }}</h1>
    </div>

    <!-- Step indicator -->
    <div class="flex items-center gap-2 mb-6">
      <div
        v-for="i in 2"
        :key="i"
        class="h-1.5 flex-1 rounded-full transition-colors"
        :class="i <= step ? 'bg-accent' : 'bg-bg-tertiary'"
      />
    </div>

    <div class="bg-bg-secondary border border-border rounded-lg p-6">
      <!-- Loading state -->
      <div v-if="isLoadingService" class="py-8 text-center text-text-secondary text-sm">
        {{ t('submit.loadingService') }}
      </div>
      <div v-else-if="serviceLoadError" class="py-8 text-center text-danger text-sm">
        {{ serviceLoadError }}
      </div>

      <!-- Step 1: Fill Content -->
      <div v-else-if="step === 1">
        <div
          v-if="sessionId"
          class="mb-4 rounded-md border border-accent/25 bg-accent-soft px-3 py-2 text-xs font-semibold text-accent"
        >
          {{ t('submit.followUpBanner') }}
        </div>
        <div v-if="service" class="mb-4 p-3 bg-bg-primary border border-border rounded-md">
          <p class="font-medium text-sm">{{ displayServiceName }}</p>
          <p class="text-xs text-text-secondary mt-1">{{ displayServiceDesc || t('submit.noDescription') }}</p>
        </div>
        <h2 class="text-lg font-semibold mb-4">{{ t('submit.step1') }}</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1">{{ t('submit.taskTitle') }}</label>
            <input
              v-model="title"
              type="text"
              class="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-sm focus:border-accent focus:outline-none"
              :placeholder="t('submit.taskTitlePlaceholder')"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1">
              {{ t('submit.taskPrompt') }}
              <code class="ml-1 rounded bg-bg-inset border border-border px-1.5 py-0.5 text-xs font-normal text-accent">task_prompt</code>
            </label>
            <textarea
              v-model="taskPrompt"
              rows="5"
              class="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-sm focus:border-accent focus:outline-none resize-y"
              :placeholder="t('submit.taskPromptPlaceholder')"
            />
            <p class="text-xs text-text-muted mt-1">{{ t('submit.taskPromptHint') }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1">
              {{ t('submit.outputPrompt') }}
              <code class="ml-1 rounded bg-bg-inset border border-border px-1.5 py-0.5 text-xs font-normal text-accent">output_prompt</code>
            </label>
            <textarea
              v-model="outputPrompt"
              rows="3"
              class="w-full px-3 py-2 bg-bg-primary border border-border rounded-md text-sm focus:border-accent focus:outline-none resize-y"
              :placeholder="t('submit.outputPromptPlaceholder')"
            />
          </div>
          <div
            class="border-2 border-dashed rounded-md p-4 text-center transition-colors"
            :class="dragOver ? 'border-accent bg-accent/5' : 'border-border'"
            @dragover.prevent
            @dragenter.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
          >
            <label class="block text-sm font-medium text-text-secondary mb-2">{{ t('submit.attachments') }}</label>
            <input
              id="file-input"
              type="file"
              multiple
              class="hidden"
              @change="files = ($event.target as HTMLInputElement).files"
            />
            <label for="file-input" class="cursor-pointer text-sm text-accent hover:underline">
              {{ t('submit.chooseFiles') }}
            </label>
            <p class="text-xs text-text-muted mt-1">{{ t('submit.dragHint') }}</p>
            <p v-if="files && files.length > 0" class="text-xs text-text-secondary mt-2">
              {{ t('submit.filesSelected', { n: files.length }) }}
            </p>
          </div>
        </div>
        <div class="flex justify-end mt-6">
          <button
            class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
            @click="nextStep"
          >
            {{ t('submit.next') }}
          </button>
        </div>
      </div>

      <!-- Step 2: Confirm -->
      <div v-if="step === 2">
        <div v-if="service" class="mb-4 p-3 bg-bg-primary border border-border rounded-md">
          <p class="font-medium text-sm">{{ displayServiceName }}</p>
          <p class="text-xs text-text-secondary mt-1">{{ displayServiceDesc || t('submit.noDescription') }}</p>
        </div>
        <h2 class="text-lg font-semibold mb-4">{{ t('submit.step2') }}</h2>
        <div class="space-y-2 text-sm mb-6">
          <div class="flex">
            <span class="text-text-secondary w-24">{{ t('submit.labelService') }}</span>
            <span>{{ displayServiceName || '-' }}</span>
          </div>
          <div class="flex">
            <span class="text-text-secondary w-24">{{ t('submit.labelTitle') }}</span>
            <span>{{ title || '未命名任务' }}</span>
          </div>
          <div class="flex">
            <span class="text-text-secondary w-24">{{ t('submit.labelFiles') }}</span>
            <span>{{ t('submit.filesCount', { n: files?.length || 0 }) }}</span>
          </div>
        </div>
        <div class="flex justify-between">
          <button
            class="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-bg-tertiary transition-colors"
            @click="prevStep"
          >
            {{ t('submit.prev') }}
          </button>
          <button
            class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
            :disabled="taskStore.isSubmitting"
            @click="submit"
          >
            {{ taskStore.isSubmitting ? t('submit.submitting') : t('submit.confirmSubmit') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
