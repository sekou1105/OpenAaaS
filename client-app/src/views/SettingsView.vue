<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useServerStore } from '@/stores/server'
import { useUiStore } from '@/stores/ui'
import { friendlyErrorMessage } from '@/utils/error'

const serverStore = useServerStore()
const uiStore = useUiStore()
const { t } = useI18n()

const showAddForm = ref(false)
const newAlias = ref('')
const newUrl = ref('https://openaaas.buaa.edu.cn')
const registerAlias = ref('')
const registerName = ref('')
const registerPassword = ref('')
const showRegisterForm = ref(false)

function addServer() {
  if (!newAlias.value.trim()) {
    uiStore.addToast(t('settings.toastAliasRequired'), 'error')
    return
  }
  if (!newUrl.value.trim()) {
    uiStore.addToast(t('settings.toastUrlRequired'), 'error')
    return
  }
  if (!/^https?:\/\//i.test(newUrl.value)) {
    uiStore.addToast(t('settings.toastUrlProtocol'), 'error')
    return
  }
  try {
    new URL(newUrl.value.trim())
  } catch {
    uiStore.addToast(t('settings.toastUrlInvalid'), 'error')
    return
  }
  try {
    serverStore.addServer({
      alias: newAlias.value.trim(),
      serverUrl: newUrl.value.trim(),
    })
    uiStore.addToast(t('settings.toastAddSuccess'), 'success')
    newAlias.value = ''
    newUrl.value = ''
    showAddForm.value = false
  } catch (err) {
    const msg = err instanceof Error ? friendlyErrorMessage(err.message) : friendlyErrorMessage(String(err))
    uiStore.addToast(msg, 'error')
  }
}

async function doRegister() {
  if (!registerName.value.trim()) {
    uiStore.addToast(t('settings.toastUsernameRequired'), 'error')
    return
  }
  if (!registerPassword.value) {
    uiStore.addToast(t('settings.toastPasswordRequired'), 'error')
    return
  }
  try {
    uiStore.setLoading(true)
    // 注册与登录已合并：服务端在统一认证通过后自动创建用户（首次）或重签 Key（再次）
    await serverStore.login(registerAlias.value, registerName.value.trim(), registerPassword.value)
    uiStore.addToast(registerIsRelogin.value ? t('settings.toastReloginSuccess') : t('settings.toastRegisterSuccess'), 'success')
    showRegisterForm.value = false
    registerName.value = ''
    registerPassword.value = ''
  } catch (err) {
    const msg = err instanceof Error ? friendlyErrorMessage(err.message) : friendlyErrorMessage(String(err))
    uiStore.addToast(msg, 'error')
  } finally {
    uiStore.setLoading(false)
  }
}

function openRegister(alias: string) {
  registerAlias.value = alias
  showRegisterForm.value = true
}

/** 目标服务器已有 Key 或 Key 已失效时，登录动作视为「重新登录」 */
const registerIsRelogin = computed(() => {
  const server = serverStore.servers.find((s) => s.alias === registerAlias.value)
  return !!server?.apiKey || serverStore.isAuthExpired(registerAlias.value)
})

function closeRegister() {
  showRegisterForm.value = false
  registerName.value = ''
  registerPassword.value = ''
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">{{ t('settings.title') }}</h1>

    <!-- Server List -->
    <div class="bg-bg-secondary border border-border rounded-lg p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">{{ t('settings.serverMgmt') }}</h2>
        <button
          class="px-3 py-1.5 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
          @click="showAddForm = !showAddForm"
        >
          {{ showAddForm ? t('common.cancel') : t('settings.addServer') }}
        </button>
      </div>

      <!-- Add form -->
      <div v-if="showAddForm" class="bg-bg-primary border border-border rounded-md p-4 mb-4">
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1">{{ t('settings.alias') }}</label>
            <input
              v-model="newAlias"
              type="text"
              class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-md text-sm focus:border-accent focus:outline-none"
              :placeholder="t('settings.aliasPlaceholder')"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1">{{ t('settings.serverUrl') }}</label>
            <input
              v-model="newUrl"
              type="text"
              class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-md text-sm focus:border-accent focus:outline-none"
              placeholder="https://openaaas.buaa.edu.cn"
            />
            <p class="text-xs text-text-muted mt-1">{{ t('settings.urlHint') }}</p>
          </div>
          <div class="flex gap-2">
            <button
              class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
              @click="addServer"
            >
              {{ t('settings.confirmAdd') }}
            </button>
            <button
              class="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-bg-tertiary transition-colors"
              @click="showAddForm = false"
            >
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Register form -->
      <div v-if="showRegisterForm" class="bg-bg-primary border border-border rounded-md p-4 mb-4">
        <p class="text-sm text-text-secondary mb-3">
          {{ registerIsRelogin ? t('settings.reloginTo') : t('settings.registerTo') }}: <strong>{{ registerAlias }}</strong>
        </p>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1">{{ t('settings.username') }}</label>
            <input
              v-model="registerName"
              type="text"
              class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-md text-sm focus:border-accent focus:outline-none"
              :placeholder="t('settings.usernamePlaceholder')"
            />
            <p class="text-xs text-text-muted mt-1">{{ t('settings.usernameHint') }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-text-secondary mb-1">{{ t('settings.password') }}</label>
            <input
              v-model="registerPassword"
              type="password"
              class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-md text-sm focus:border-accent focus:outline-none"
              :placeholder="t('settings.passwordPlaceholder')"
            />
          </div>
          <div class="flex gap-2">
            <button
              class="px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
              @click="doRegister"
            >
              {{ registerIsRelogin ? t('settings.relogin') : t('settings.register') }}
            </button>
            <button
              class="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-bg-tertiary transition-colors"
              @click="closeRegister"
            >
              {{ t('common.back') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Server list -->
      <div v-if="serverStore.servers.length === 0" class="text-center py-8 text-text-muted">
        <p>{{ t('settings.noServers') }}</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="server in serverStore.servers"
          :key="server.alias"
          class="bg-bg-primary border rounded-md p-3 flex items-center gap-3 flex-wrap"
          :class="server.isDefault ? 'border-accent bg-accent/5' : 'border-border'"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm">{{ server.alias }}</span>
              <span
                v-if="server.isDefault"
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent"
              >
                {{ t('settings.defaultTag') }}
              </span>
              <span
                v-if="server.apiKey"
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-success/10 text-success"
              >
                {{ t('settings.registered') }}
              </span>
              <span
                v-if="serverStore.isAuthExpired(server.alias)"
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-danger/10 text-danger"
              >
                {{ t('settings.authExpired') }}
              </span>
              <span
                v-if="!server.apiKey"
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-danger/10 text-danger"
              >
                {{ t('settings.notRegistered') }}
              </span>
            </div>
            <p class="text-xs text-text-muted truncate">{{ server.serverUrl }}</p>
          </div>

          <div class="flex gap-2">
            <button
              v-if="!server.isDefault"
              class="px-2 py-1 text-xs border border-border rounded hover:bg-bg-tertiary transition-colors"
              @click="serverStore.setDefault(server.alias)"
            >
              {{ t('settings.setDefault') }}
            </button>
            <button
              v-if="!server.apiKey"
              class="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover transition-colors"
              @click="openRegister(server.alias)"
            >
              {{ t('settings.register') }}
            </button>
            <button
              v-else
              class="px-2 py-1 text-xs rounded transition-colors"
              :class="serverStore.isAuthExpired(server.alias)
                ? 'bg-danger text-white hover:opacity-90'
                : 'border border-border hover:bg-bg-tertiary'"
              @click="openRegister(server.alias)"
            >
              {{ t('settings.relogin') }}
            </button>
            <button
              v-if="!server.isDefault"
              class="px-2 py-1 text-xs bg-danger text-white rounded hover:opacity-90 transition-opacity"
              @click="serverStore.removeServer(server.alias)"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
