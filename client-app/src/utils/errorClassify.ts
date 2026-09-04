/**
 * 失败原因细分：将任务 errorMessage 归类为用户可理解的类别，
 * 并给出对应的处理建议。纯展示层工具，不影响数据流。
 */

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

const CATEGORY_META: Record<ErrorCategory, { label: string; suggestion: string }> = {
  'cancelled-by-user': {
    label: '手动取消',
    suggestion: '该任务由用户主动取消。如需相同结果，可使用「一键重试」重新提交。',
  },
  'too-many-files': {
    label: '回答文件过多',
    suggestion:
      '服务检测到工作区中存在多个候选文件。请进入服务工作区清理历史任务产生的文件，仅保留本次需要的业务文件后重试；系统自带的说明文件（如 README.md）也可能被误识别，清理时请注意区分。',
  },
  permission: {
    label: '权限不足',
    suggestion: '服务或附件访问权限不足。请确认您已获得该服务的授权，或联系服务提供方开通权限后重试。',
  },
  network: {
    label: '网络异常',
    suggestion: '与服务器通信失败。请检查网络连接和服务器地址配置，然后使用「一键重试」。',
  },
  'payload-too-large': {
    label: '附件过大',
    suggestion: '上传的附件超过大小限制。请压缩或拆分附件后重新提交。',
  },
  'server-error': {
    label: '服务端执行错误',
    suggestion: '服务端执行过程中出错。可直接「一键重试」；若多次失败，请将失败信息反馈给服务提供方。',
  },
  unknown: {
    label: '未知原因',
    suggestion: '失败原因未能识别。建议「一键重试」一次；若仍失败，请联系服务提供方排查。',
  },
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

  return { category, ...CATEGORY_META[category] }
}
