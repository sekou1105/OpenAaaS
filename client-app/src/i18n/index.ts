import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'
import { loadState, saveState } from '@/stores/persist'

export type AppLocale = 'zh-CN' | 'en-US'
export const SUPPORTED_LOCALES: AppLocale[] = ['zh-CN', 'en-US']
export const DEFAULT_LOCALE: AppLocale = 'zh-CN'

function resolveInitialLocale(): AppLocale {
  const persisted = loadState().locale
  if (persisted === 'zh-CN' || persisted === 'en-US') return persisted
  return DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  saveState({ locale })
}

export function toggleLocale() {
  setLocale(i18n.global.locale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
}
