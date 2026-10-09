/**
 * 将技术性错误 message 映射为用户友好的文案。
 * 文案经 i18n 解析，随界面语言切换。
 */
import { i18n } from '@/i18n'

export function friendlyErrorMessage(message: string): string {
  if (!message) return i18n.global.t('storeError.opFailed')
  const lower = message.toLowerCase()
  if (
    lower.includes('payload too large') ||
    lower.includes('entity too large') ||
    lower.includes('too large') ||
    lower.includes('过大')
  ) {
    return i18n.global.t('storeError.payloadTooLarge')
  }
  return message
}
