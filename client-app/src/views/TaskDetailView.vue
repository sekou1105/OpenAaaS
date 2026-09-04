<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useTaskStore, type TaskFile } from '@/stores/task'
import Skeleton from '@/components/Skeleton.vue'
import { useUiStore } from '@/stores/ui'
import { useServerStore } from '@/stores/server'
import { friendlyErrorMessage } from '@/utils/error'
import { classifyTaskError } from '@/utils/errorClassify'
import { httpFetch } from '@/composables/useHttp'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

const route = useRoute()
const router = useRouter()
const taskStore = useTaskStore()
const uiStore = useUiStore()
const serverStore = useServerStore()

const taskId = computed(() => String(route.params.id))
const task = computed(() => taskStore.getTask(taskId.value))

const realFiles = computed(() => task.value?.files.filter(f => !f.isPlaceholder) ?? [])
const formattedCreatedAt = computed(() => formatTime(task.value?.createdAt))
const formattedStartedAt = computed(() => formatTime(task.value?.startedAt))
const formattedCompletedAt = computed(() => formatTime(task.value?.completedAt))
const duration = computed(() => durationText(task.value?.startedAt || task.value?.createdAt, task.value?.completedAt))

const statusLabelMap: Record<string, string> = {
  pending: '排队中',
  running: '进行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  cancelling: '取消中',
}

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
  if (sec < 60) return `${sec}秒`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分${sec % 60}秒`
  const h = Math.floor(min / 60)
  return `${h}小时${min % 60}分`
}

const isTerminal = computed(() => {
  const s = task.value?.status
  return s === 'completed' || s === 'failed' || s === 'cancelled' || s === 'cancelling'
})

const canCancel = computed(() => {
  const s = task.value?.status
  return s === 'pending' || s === 'running'
})

async function handleCancel() {
  if (!task.value) return
  try {
    uiStore.setLoading(true)
    await taskStore.cancelTask(task.value.id)
    uiStore.addToast('任务已取消', 'success')
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
    uiStore.addToast('已重新提交任务（不含原附件）', 'success')
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
  uiStore.addToast('任务记录已删除', 'success')
  router.push('/tasks')
}

async function handleResumePolling() {
  if (!task.value) return
  try {
    uiStore.setLoading(true)
    taskStore.resumePollingForTask(task.value.id)
    uiStore.addToast('已恢复轮询', 'success')
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
  const t = task.value
  if (!t) return
  const server = serverStore.servers.find((s) => s.alias === t.serverAlias)
  if (!server || !server.apiKey) {
    uiStore.addToast('服务器配置不存在', 'error')
    return
  }
  try {
    uiStore.setLoading(true)
    const baseUrl = server.serverUrl.replace(/\/$/, '')
    const url = `${baseUrl}/api/v1/client/files/${encodeURIComponent(file.id)}/download`
    const res = await httpFetch(url, {
      headers: { Authorization: `Bearer ${server.apiKey}` },
    })
    if (!res.ok) throw new Error(`下载失败: ${res.status}`)
    const blob = await res.blob()

    try {
      const safeName = file.filename.replace(/[/\\]/g, '_')
      const filePath = await save({ defaultPath: safeName })
      if (!filePath) {
        uiStore.addToast('已取消保存', 'info')
        return
      }
      const arrayBuffer = await blob.arrayBuffer()
      await writeFile(filePath, new Uint8Array(arrayBuffer))
      uiStore.addToast(`文件已保存: ${filePath}`, 'success', 6000)
    } catch {
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = file.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
      uiStore.addToast('文件已开始下载，请查看系统下载文件夹', 'info', 5000)
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
      <nav class="mb-2 flex items-center gap-1.5 text-sm text-text-secondary" aria-label="面包屑">
        <button type="button" class="hover:text-text-primary" @click="goBack">← 返回</button>
        <span class="text-text-muted">|</span>
        <router-link to="/tasks" class="hover:text-text-primary">任务列表</router-link>
        <span class="text-text-muted">/</span>
        <span class="text-text-primary">任务详情</span>
      </nav>
      <h1 class="text-2xl font-bold mt-2">任务详情</h1>
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
          轮询中
        </span>
      </div>

      <h2 class="text-lg font-semibold mb-1">{{ task.title }}</h2>
      <p class="text-sm text-text-secondary mb-4">服务: {{ task.serviceName }}</p>

      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary mb-6">
        <span>创建: {{ formattedCreatedAt }}</span>
        <span v-if="task.startedAt">开始: {{ formattedStartedAt }}</span>
        <span v-if="task.completedAt">完成: {{ formattedCompletedAt }}</span>
        <span>耗时: {{ duration }}</span>
      </div>

      <!-- Result area -->
      <div v-if="task.result != null" class="mb-6">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-2">结果</h3>
        <div class="bg-bg-primary border border-border rounded-md p-4 text-sm leading-relaxed prose max-w-none" v-html="renderedResult" />
      </div>
      <div v-else-if="task.status === 'completed' && task.isFetchingResult" class="mb-6">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-2">结果</h3>
        <Skeleton :rows="6" height="14px" />
      </div>

      <!-- Files -->
      <div v-if="realFiles.length > 0" class="mb-6">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-2">结果文件</h3>
        <div class="space-y-2">
          <div
            v-for="file in realFiles"
            :key="file.id"
            class="flex items-center gap-3 bg-bg-primary border border-border rounded-md px-3 py-2"
          >
            <span class="text-sm flex-1">{{ file.filename }}</span>
            <span class="text-xs text-text-muted">{{ (file.sizeBytes / 1024).toFixed(1) }} KB</span>
            <button
              class="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover transition-colors"
              @click="downloadFile(file)"
            >
              下载
            </button>
          </div>
        </div>
      </div>
      <div v-else-if="task.status === 'completed' && task.isFetchingResult" class="mb-6">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-text-secondary mb-2">结果文件</h3>
        <Skeleton :rows="2" height="14px" />
      </div>

      <!-- Error -->
      <div v-if="task.errorMessage || task.fetchError" class="mb-6">
        <div class="bg-danger/5 border border-danger/20 rounded-md p-3 text-sm text-danger">
          <div v-if="classifiedError" class="mb-1">
            <span class="font-semibold">失败原因：{{ classifiedError.label }}</span>
          </div>
          {{ task.errorMessage || task.fetchError }}
          <p v-if="classifiedError" class="mt-2 text-xs text-text-secondary">
            建议：{{ classifiedError.suggestion }}
          </p>
        </div>
      </div>

      <!-- Poll Error -->
      <div v-if="task.pollError" class="mb-6">
        <div class="bg-danger/5 border border-danger/20 rounded-md p-3 text-sm text-danger">
          {{ task.pollError }}
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-3">
        <button
          v-if="canCancel"
          class="px-4 py-2 bg-danger text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          @click="handleCancel"
        >
          取消任务
        </button>
        <button
          v-if="canCancel && task.pollError"
          class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
          @click="handleResumePolling"
        >
          恢复轮询
        </button>
        <button
          v-if="canRetry"
          class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          :disabled="taskStore.isSubmitting"
          title="使用原任务的描述和输出要求重新提交（不含原附件）"
          @click="handleRetry"
        >
          {{ taskStore.isSubmitting ? '提交中...' : '一键重试' }}
        </button>
        <button
          v-if="isTerminal"
          class="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-bg-tertiary transition-colors"
          title="带着原任务内容前往提交页，可修改后再提交"
          @click="handleResubmit"
        >
          修改后重新提交
        </button>
        <button
          v-if="isTerminal"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
          :class="confirmingDelete
            ? 'bg-danger text-white hover:opacity-90'
            : 'border border-danger/30 text-danger hover:bg-danger/5'"
          @click="handleDelete"
        >
          {{ confirmingDelete ? '确认删除？' : '删除记录' }}
        </button>
      </div>
    </div>
  </div>

  <div v-else class="max-w-3xl mx-auto text-text-muted">
    <p>任务不存在或已被删除</p>
    <router-link to="/" class="text-accent hover:underline text-sm mt-2 inline-block">返回首页</router-link>
  </div>
</template>
