import { describe, expect, it, beforeEach } from 'vitest'
import { i18n, setLocale, toggleLocale } from '../index'
import { loadState } from '@/stores/persist'
import zhCN from '../locales/zh-CN'
import enUS from '../locales/en-US'

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') return collectKeys(v as Record<string, unknown>, key)
    return [key]
  })
}

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear()
    setLocale('zh-CN')
  })

  it('默认为中文', () => {
    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(i18n.global.t('nav.home')).toBe('服务市场')
  })

  it('toggleLocale 在中英文之间切换', () => {
    toggleLocale()
    expect(i18n.global.locale.value).toBe('en-US')
    expect(i18n.global.t('nav.home')).toBe('Marketplace')
    toggleLocale()
    expect(i18n.global.locale.value).toBe('zh-CN')
    expect(i18n.global.t('nav.home')).toBe('服务市场')
  })

  it('切换语言会持久化到本地存储', () => {
    setLocale('en-US')
    expect(loadState().locale).toBe('en-US')
    setLocale('zh-CN')
    expect(loadState().locale).toBe('zh-CN')
  })

  it('中英文语言包 key 完全一致', () => {
    const zhKeys = collectKeys(zhCN).sort()
    const enKeys = collectKeys(enUS).sort()
    expect(enKeys).toEqual(zhKeys)
  })

  it('英文模式下插值正常工作', () => {
    setLocale('en-US')
    expect(i18n.global.t('tasks.confirmClear', { n: 3 })).toBe('Clear 3 finished tasks?')
    setLocale('zh-CN')
    expect(i18n.global.t('tasks.confirmClear', { n: 3 })).toBe('确认清空 3 条历史？')
  })
})
