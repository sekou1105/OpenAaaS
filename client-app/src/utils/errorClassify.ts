/**
 * 失败原因细分：将任务 errorMessage 归类为用户可理解的类别，
 * 并给出对应的处理建议。纯展示层工具，不影响数据流。
 * 文案经 i18n 解析，随界面语言切换。
 */

import { i18n } from '@/i18n'

export type ErrorCategory =
  | 'cancelled-by-user'
  | 'too-many-files'
  | 'permission'
  | 'network'
  | 'payload-too-large'
  | 'server-error'
  | 'unknown'

export interface ClassifiedError {
  category: ErrorCategory
  /** 类别标签，如「手动取消」 */
  label: string
  /** 给用户的处理建议 */
  suggestion: string
}

const CATEGORY_KEY: Record<ErrorCategory, string> = {
  'cancelled-by-user': 'cancelledByUser',
  'too-many-files': 'tooManyFiles',
  permission: 'permission',
  network: 'network',
  'payload-too-large': 'payloadTooLarge',
  'server-error': 'serverError',
  unknown: 'unknown',
}

function categoryMeta(category: ErrorCategory): { label: string; suggestion: string } {
  const key = CATEGORY_KEY[category]
  return {
    label: i18n.global.t(`errorClassify.${key}Label`),
    suggestion: i18n.global.t(`errorClassify.${key}Suggestion`),
  }
}

export function classifyTaskError(errorMessage?: string): ClassifiedError | null {
  if (!errorMessage) return null
  const text = errorMessage
  const lower = text.toLowerCase()

  let category: ErrorCategory
  if (
    lower.includes('回答文件过多') ||
    lower.includes('too many files') ||
    (lower.includes('文件过多') && lower.includes('回答'))
  ) {
    category = 'too-many-files'
  } else if (
    lower.includes('cancelled') ||
    lower.includes('canceled') ||
    lower.includes('已取消') ||
    lower.includes('手动取消')
  ) {
    category = 'cancelled-by-user'
  } else if (
    lower.includes('permission') ||
    lower.includes('forbidden') ||
    lower.includes('unauthorized') ||
    lower.includes('权限') ||
    lower.includes('未授权')
  ) {
    category = 'permission'
  } else if (
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('网络') ||
    lower.includes('超时') ||
    lower.includes('连接失败')
  ) {
    category = 'network'
  } else if (
    lower.includes('too large') ||
    lower.includes('payload') ||
    lower.includes('过大')
  ) {
    category = 'payload-too-large'
  } else if (
    lower.includes('internal') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('服务') ||
    lower.includes('执行失败') ||
    lower.includes('error')
  ) {
    category = 'server-error'
  } else {
    category = 'unknown'
  }

  return { category, ...categoryMeta(category) }
}
