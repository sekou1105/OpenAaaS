<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServerStore } from '@/stores/server'
import { useUiStore } from '@/stores/ui'
import { friendlyErrorMessage } from '@/utils/error'

/**
 * CAS 页面跳转认证回调页。
 * server 验票通过后 302 到 {web_url}/#/cas/callback?code=xxx（失败则 ?error=xxx），
 * 本页面用一次性交换码换取 api_key 并写入本地。
 */
const route = useRoute()
const router = useRouter()
const serverStore = useServerStore()
const uiStore = useUiStore()

const status = ref<'processing' | 'error'>('processing')
const errorMessage = ref('')

onMounted(async () => {
  const error = route.query.error as string | undefined
  const code = route.query.code as string | undefined

  if (error) {
    status.value = 'error'
    errorMessage.value = error
    uiStore.addToast(`统一认证登录失败: ${error}`, 'error')
    setTimeout(() => router.replace('/settings'), 2000)
    return
  }

  if (!code) {
    status.value = 'error'
    errorMessage.value = '回调参数缺失'
    setTimeout(() => router.replace('/settings'), 2000)
    return
  }

  const alias = localStorage.getItem('openaaas_cas_pending_alias')
  localStorage.removeItem('openaaas_cas_pending_alias')
  if (!alias) {
    status.value = 'error'
    errorMessage.value = '登录状态丢失，请重新发起登录'
    setTimeout(() => router.replace('/settings'), 2000)
    return
  }

  try {
    uiStore.setLoading(true)
    await serverStore.loginByCas(alias, code)
    uiStore.addToast('统一认证登录成功', 'success')
    router.replace('/settings')
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err instanceof Error ? friendlyErrorMessage(err.message) : String(err)
    setTimeout(() => router.replace('/settings'), 2000)
  } finally {
    uiStore.setLoading(false)
  }
})
</script>

<template>
  <div class="max-w-3xl mx-auto text-center py-16">
    <div v-if="status === 'processing'">
      <p class="text-lg font-medium mb-2">正在完成统一认证登录…</p>
      <p class="text-sm text-text-muted">请稍候，正在换取访问凭证</p>
    </div>
    <div v-else>
      <p class="text-lg font-medium mb-2 text-danger">登录失败</p>
      <p class="text-sm text-text-muted">{{ errorMessage }}，即将返回设置页…</p>
    </div>
  </div>
</template>
