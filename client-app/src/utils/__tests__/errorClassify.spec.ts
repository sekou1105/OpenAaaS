import { describe, it, expect } from 'vitest'
import { classifyTaskError } from '../errorClassify'

describe('classifyTaskError', () => {
  it('returns null for empty message', () => {
    expect(classifyTaskError(undefined)).toBeNull()
    expect(classifyTaskError('')).toBeNull()
  })

  it('classifies too-many-files errors', () => {
    const r = classifyTaskError('回答文件过多，请清理工作区后重新请求')
    expect(r?.category).toBe('too-many-files')
    expect(r?.label).toBe('回答文件过多')
    expect(r?.suggestion).toContain('工作区')
  })

  it('classifies user cancellation', () => {
    expect(classifyTaskError('Task cancelled by user')?.category).toBe('cancelled-by-user')
    expect(classifyTaskError('任务已取消')?.category).toBe('cancelled-by-user')
  })

  it('classifies permission errors', () => {
    expect(classifyTaskError('服务权限不足，无法读取上传附件')?.category).toBe('permission')
    expect(classifyTaskError('403 Forbidden')?.category).toBe('permission')
  })

  it('classifies network errors', () => {
    expect(classifyTaskError('request timeout')?.category).toBe('network')
    expect(classifyTaskError('网络连接失败')?.category).toBe('network')
  })

  it('classifies payload-too-large errors', () => {
    expect(classifyTaskError('payload too large')?.category).toBe('payload-too-large')
  })

  it('classifies generic server errors', () => {
    expect(classifyTaskError('internal server error')?.category).toBe('server-error')
  })

  it('falls back to unknown', () => {
    expect(classifyTaskError('???')?.category).toBe('unknown')
  })
})
