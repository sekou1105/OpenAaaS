<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useTaskStore, type TaskFile } from '@/stores/task'
import Skeleton from '@/components/Skeleton.vue'
import { useUiStore } from '@/stores/ui'
import { useServerStore } from '@/stores/server'
import { friendlyErrorMessage } from '@/utils/error'
import { classifyTaskError } from '@/utils/errorClassify'
import { formatSeconds } from '@/utils/estimate'
import { filePurpose } from '@/utils/filePurpose'
import { localizedServiceName } from '@/i18n/serviceEn'
import { httpFetch } from '@/composables/useHttp'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const uiStore = useUiStore()
const serverStore = useServerStore()
const { t } = useI18n()

const taskId = computed(() => String(route.params.id))
const task = computed(() => taskStore.getTask(taskId.value))

const realFiles = computed(() => task.value?.files.filter(f => !f.isPlaceholder) ?? [])
const formattedCreatedAt = computed(() => formatTime(task.value?.createdAt))
const formattedStartedAt = computed(() => formatTime(task.value?.startedAt))
const formattedCompletedAt = computed(() => formatTime(task.value?.completedAt))
const duration = computed(() => durationText(task.value?.startedAt || task.value?.createdAt, task.value?.completedAt))

const statusLabelMap = computed<Record<string, string>>(() => ({
  pending: t('status.pending'),
  running: t('status.runningAlt'),
  completed: t('status.completed'),
  failed: t('status.failed'),
  cancelled: t('status.canceled'),
  cancelling: t('status.cancelling'),
}))

const statusClassMap: Record<string, string> = {
  pending: 'bg-accent/10 text-accent',
  running: 'bg-info-soft text-info',
  completed: 'bg-success/10 text-success',
  failed: 'bg-danger/10 text-danger',
  cancelled: 'bg-danger/10 text-danger',
  cancelling: 'bg-danger/10 text-danger',
}

function formatTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function durationText(startIso?: string, endIso?: string): string {
  if (!startIso) return '-'
  const start = new Date(startIso).getTime()
  if (isNaN(start)) return '-'
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const sec = Math.max(0, Math.floor((end - start) / 1000))
  if (sec < 60) return t('taskDetail.durSec', { n: sec })
  const min = Math.floor(sec / 60)
  if (min < 60) return t('taskDetail.durMinSec', { m: min, s: sec % 60 })
  const h = Math.floor(min / 60)
  return t('taskDetail.durHourMin', { h, m: min % 60 })
}

const isTerminal = computed(() => {
  const s = task.value?.status
  return s === 'completed' || s === 'failed' || s === 'cancelled' || s === 'cancelling'
})

const canCancel = computed(() => {
  const s = task.value?.status
  return s === 'pending' || s === 'running'
})

/** 进行中/排队中任务的预计耗时（同服务历史已完成任务的均值） */
const durationEstimate = computed(() => {
  const tk = task.value
  if (!tk || isTerminal.value) return null
  return taskStore.estimateServiceDuration(tk.serviceId)
})

const estimateText = computed(() => {
  const est = durationEstimate.value
  if (!est) return ''
  let text = t('taskDetail.estTotal', { avg: formatSeconds(est.avgSeconds), n: est.sampleCount })
  if (task.value?.status === 'running' && task.value.startedAt) {
    const elapsed = (Date.now() - new Date(task.value.startedAt).getTime()) / 1000
    const remaining = est.avgSeconds - elapsed
    if (remaining > 0) text += t('taskDetail.estRemaining', { remain: formatSeconds(remaining) })
    else text += t('taskDetail.estOverrun')
  }
  return text
})

async function handleCancel() {
  if (!task.value) return
  try {
    uiStore.setLoading(true)
    await taskStore.cancelTask(task.value.id)
    uiStore.addToast(t('taskDetail.toastCancelled'), 'success')
  } catch (err) {
    const msg = err instanceof Error ? friendlyErrorMessage(err.message) : friendlyErrorMessage(String(err))
    uiStore.addToast(msg, 'error')
  } finally {
    uiStore.setLoading(false)
  }
}

function handleResubmit() {
  if (!task.value) return
  router.push({
    path: `/submit/${task.value.serviceId}`,
    query: {
      title: task.value.title,
      taskPrompt: task.value.taskPrompt,
      outputPrompt: task.value.outputPrompt,
    },
  })
}

const canRetry = computed(() => {
  const s = task.value?.status
  return s === 'failed' || s === 'cancelled'
})

const classifiedError = computed(() => {
  const msg = task.value?.errorMessage
  if (msg) return classifyTaskError(msg)
  if (task.value?.status === 'cancelled') return classifyTaskError('cancelled')
  return null
})

async function handleRetry() {
  if (!task.value) return
  try {
    uiStore.setLoading(true)
    const newTaskId = await taskStore.retryTask(task.value.id)
    uiStore.addToast(t('taskDetail.toastResubmitted'), 'success')
    router.push(`/task/${newTaskId}`)
  } catch (err) {
    const msg = err instanceof Error ? friendlyErrorMessage(err.message) : friendlyErrorMessage(String(err))
    uiStore.addToast(msg, 'error')
  } finally {
    uiStore.setLoading(false)
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/tasks')
  }
}

/** 已完成任务可基于结果继续追问 */
const canFollowUp = computed(() => task.value?.status === 'completed')

/** 同一会话的任务链（本地过滤，按创建时间排序） */
const sessionChain = computed(() => {
  const tk = task.value
  if (!tk?.sessionId) return []
  return taskStore.tasks
    .filter((x) => x.sessionId === tk.sessionId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
})

function handleFollowUp() {
  const tk = task.value
  if (!tk) return
  const excerpt = (tk.result || '').slice(0, 500)
  // 追问模板属于提交给服务端的业务数据，保持中文不做国际化
  const prompt = [
    '【追问背景】',
    `原任务：${tk.taskPrompt}`,
    excerpt ? `前次结果摘要：${excerpt}${(tk.result || '').length > 500 ? '……' : ''}` : '',
    '',
    '【我的新问题】',
    '',
  ].join('\n')
  router.push({
    path: `/submit/${tk.serviceId}`,
    query: {
      title: `（追问）${tk.title}`,
      taskPrompt: prompt,
      outputPrompt: tk.outputPrompt,
      ...(tk.sessionId ? { sessionId: tk.sessionId } : {}),
    },
  })
}

// 二次点击确认删除（避免 window.confirm 在 Tauri Webview 中的兼容性问题）
const confirmingDelete = ref(false)
let deleteConfirmTimer: number | undefined

function handleDelete() {
  if (!task.value) return
  if (!confirmingDelete.value) {
    confirmingDelete.value = true
    deleteConfirmTimer = window.setTimeout(() => {
      confirmingDelete.value = false
    }, 3000)
    return
  }
  window.clearTimeout(deleteConfirmTimer)
  confirmingDelete.value = false
  taskStore.removeTask(task.value.id)
  uiStore.addToast(t('taskDetail.toastDeleted'), 'success')
  router.push('/tasks')
}

async function handleResumePolling() {
  if (!task.value) return
  try {
    uiStore.setLoading(true)
    taskStore.resumePollingForTask(task.value.id)
    uiStore.addToast(t('taskDetail.toastPollingResumed'), 'success')
  } catch (err) {
    const msg = err instanceof Error ? friendlyErrorMessage(err.message) : friendlyErrorMessage(String(err))
    uiStore.addToast(msg, 'error')
  } finally {
    uiStore.setLoading(false)
  }
}

const renderedResult = computed(() => {
  if (!task.value?.result) return ''
  const html = marked.parse(task.value.result, { async: false, breaks: true }) as string
  return DOMPurify.sanitize(html)
})

async function downloadFile(file: TaskFile) {
  const tk = task.value
  if (!tk) return
  const server = serverStore.servers.find((s) => s.alias === tk.serverAlias)
  if (!server || !server.apiKey) {
    uiStore.addToast(t('taskDetail.toastServerMissing'), 'error')
    return
  }
  try {
    uiStore.setLoading(true)
    const baseUrl = server.serverUrl.replace(/\/$/, '')
    const url = `${baseUrl}/api/v1/client/files/${encodeURIComponent(file.id)}/download`
    const res = await httpFetch(url, {
      headers: { Authorization: `Bearer ${server.apiKey}` },
    })
    // 错误信息会进入 errorClassify/friendlyError 中文匹配管线，保持原文
    if (!res.ok) throw new Error(`下载失败: ${res.status}`)
    const blob = await res.blob()

    try {
      const safeName = file.filename.replace(/[/\\]/g, '_')
      const filePath = await save({ defaultPath: safeName })
      if (!filePath) {
        uiStore.addToast(t('taskDetail.toastSaveCancelled'), 'info')
        return
      }
      const arrayBuffer = await blob.arrayBuffer()
      await writeFile(filePath, new Uint8Array(arrayBuffer))
      uiStore.addToast(t('taskDetail.toastFileSaved', { path: filePath }), 'success', 6000)
    } catch {
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = file.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
      uiStore.addToast(t('taskDetail.toastDownloadStarted'), 'info', 5000)
    }
  } catch (err) {
    uiStore.addToast(err instanceof Error ? friendlyErrorMessage(err.message) : friendlyErrorMessage(String(err)), 'error')
  } finally {
    uiStore.setLoading(false)
  }
}

function maybeFetchResult() {
  if (task.value && !task.value.resultFetched && task.value.status === 'completed') {
    taskStore.fetchResult(task.value.id)
  }
}

onMounted(() => {
  maybeFetchResult()
})

watch(() => route.params.id, () => {
  maybeFetchResult()
})
</script>

<template>
  <div v-if="task" class="max-w-3xl mx-auto">
    <div class="mb-6">
      <nav class="mb-2 flex items-center gap-1.5 text-sm text-text-secondary" :aria-label="t('taskDetail.breadcrumb')">
        <button type="button" class="hover:text-text-primary" @click="goBack">{{ t('taskDetail.back') }}</button>
        <span class="text-text-muted">|</span>
        <router-link to="/tasks" class="hover:text-text-primary">{{ t('taskDetail.tasks') }}</router-link>
        <span class="text-text-muted">/</span>
        <span class="text-text-primary">{{ t('taskDetail.title') }}</span>
      </nav>
      <h1 class="text-2xl font-bold mt-2">{{ t('taskDetail.title') }}</h1>
    </div>

    <div class="bg-bg-secondary border border-border rounded-lg p-6">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <span
          class="text-[11px] font-semibold px-2 py-1 rounded-full uppercase"
          :class="statusClassMap[task.status] || 'bg-bg-tertiary text-text-muted'"
        >
          {{ statusLabelMap[task.status] || task.status }}
        </span>
        <span v-if="task.isPolling" class="flex items-center gap-1.5 text-sm text-text-secondary">
          <span class="inline-block w-3 h-3 border-2 border-bg-hover border-t-accent rounded-full animate-spin" />
          {{ t('taskDetail.polling') }}
        </span>
      </div>

      <h2 class="text-lg font-semibold mb-1">{{ task.title }}</h2>
      <p class="text-sm text-text-secondary mb-4">{{ t('taskDetail.service') }} {{ localizedServiceName(task.serviceId, task.serviceName) }}</p>

      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary mb-6">
        <span>{{ t('taskDetail.created') }} {{ formattedCreatedAt }}</span>
        <span v-if="task.startedAt">{{ t('taskDetail.started') }} {{ formattedStartedAt }}</span>
        <span v-if="task.completedAt">{{ t('taskDetail.completed') }} {{ formattedCompletedAt }}</span>
        <span>{{ t('taskDetail.duration') }} {{ duration }}</span>
        <span v-if="estimateText" class="text-accent">{{ estimateText }}</span>
      </div>

      <!-- Result area -->
      <div v-if="task.result != null" class="mb-6">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-2">{{ t('taskDetail.result') }}</h3>
        <div class="bg-bg-primary border border-border rounded-md p-4 text-sm leading-relaxed prose max-w-none" v-html="renderedResult" />
      </div>
      <div v-else-if="task.status === 'completed' && task.isFetchingResult" class="mb-6">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-2">{{ t('taskDetail.result') }}</h3>
        <Skeleton :rows="6" height="14px" />
      </div>

      <!-- Files -->
      <div v-if="realFiles.length > 0" class="mb-6">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-2">{{ t('taskDetail.resultFiles') }}</h3>
        <div class="space-y-2">
          <div
            v-for="file in realFiles"
            :key="file.id"
            class="flex items-center gap-3 bg-bg-primary border border-border rounded-md px-3 py-2"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm truncate">{{ file.filename }}</p>
              <p class="text-xs text-text-muted mt-0.5">{{ t('taskDetail.filePurpose') }}{{ filePurpose(file.filename, file.mimeType) }}</p>
            </div>
            <span class="text-xs text-text-muted">{{ (file.sizeBytes / 1024).toFixed(1) }} KB</span>
            <button
              class="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover transition-colors"
              @click="downloadFile(file)"
            >
              {{ t('taskDetail.download') }}
            </button>
          </div>
        </div>
      </div>
      <div v-else-if="task.status === 'completed' && task.isFetchingResult" class="mb-6">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-2">{{ t('taskDetail.resultFiles') }}</h3>
        <Skeleton :rows="2" height="14px" />
      </div>

      <!-- Error -->
      <div v-if="task.errorMessage || task.fetchError" class="mb-6">
        <div class="bg-danger/5 border border-danger/20 rounded-md p-3 text-sm text-danger">
          <div v-if="classifiedError" class="mb-1">
            <span class="font-semibold">{{ t('taskDetail.failureReason') }}{{ classifiedError.label }}</span>
          </div>
          {{ task.errorMessage || task.fetchError }}
          <p v-if="classifiedError" class="mt-2 text-xs text-text-secondary">
            {{ t('taskDetail.suggestion') }}{{ classifiedError.suggestion }}
          </p>
        </div>
      </div>

      <!-- Poll Error -->
      <div v-if="task.pollError" class="mb-6">
        <div class="bg-danger/5 border border-danger/20 rounded-md p-3 text-sm text-danger">
          {{ task.pollError }}
        </div>
      </div>

      <!-- 会话任务链 -->
      <div v-if="sessionChain.length > 1" class="mb-6">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-2">{{ t('taskDetail.sessionChain') }}</h3>
        <div class="flex flex-wrap gap-2">
          <router-link
            v-for="(s, i) in sessionChain"
            :key="s.id"
            :to="`/task/${s.id}`"
            class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
            :class="s.id === task.id
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-bg-primary text-text-secondary hover:border-accent/40 hover:text-accent'"
          >
            {{ t('taskDetail.round', { n: i + 1 }) }} · {{ statusLabelMap[s.status] || s.status }}
          </router-link>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-3">
        <button
          v-if="canCancel"
          class="px-4 py-2 bg-danger text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          @click="handleCancel"
        >
          {{ t('taskDetail.cancelTask') }}
        </button>
        <button
          v-if="canCancel && task.pollError"
          class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
          @click="handleResumePolling"
        >
          {{ t('taskDetail.resumePolling') }}
        </button>
        <button
          v-if="canFollowUp"
          class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
          :title="t('taskDetail.followUpTitle')"
          @click="handleFollowUp"
        >
          {{ t('taskDetail.followUp') }}
        </button>
        <button
          v-if="canRetry"
          class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          :disabled="taskStore.isSubmitting"
          :title="t('taskDetail.retryTitle')"
          @click="handleRetry"
        >
          {{ taskStore.isSubmitting ? t('taskDetail.submitting') : t('taskDetail.retry') }}
        </button>
        <button
          v-if="isTerminal"
          class="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-bg-tertiary transition-colors"
          :title="t('taskDetail.resubmitTitle')"
          @click="handleResubmit"
        >
          {{ t('taskDetail.resubmit') }}
        </button>
        <button
          v-if="isTerminal"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
          :class="confirmingDelete
            ? 'bg-danger text-white hover:opacity-90'
            : 'border border-danger/30 text-danger hover:bg-danger/5'"
          @click="handleDelete"
        >
          {{ confirmingDelete ? t('taskDetail.confirmDelete') : t('taskDetail.deleteRecord') }}
        </button>
      </div>
    </div>
  </div>

  <div v-else class="max-w-3xl mx-auto text-text-muted">
    <p>{{ t('taskDetail.notFound') }}</p>
    <router-link to="/" class="text-accent hover:underline text-sm mt-2 inline-block">{{ t('taskDetail.backHome') }}</router-link>
  </div>
</template>
