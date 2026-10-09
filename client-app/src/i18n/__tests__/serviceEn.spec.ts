import { describe, expect, it, beforeEach } from 'vitest'
import { setLocale } from '../index'
import {
  localizedServiceName,
  localizedServiceDescription,
  localizedServiceUsage,
} from '../serviceEn'

const IDM_ID = '4dce11ed-4457-477a-982f-7c91794e336b'

describe('serviceEn 服务端数据英文映射', () => {
  beforeEach(() => {
    setLocale('zh-CN')
  })

  it('中文环境下始终返回服务端原文', () => {
    expect(localizedServiceName(IDM_ID, 'IDM-Alpha材料科学文献研究助手')).toBe('IDM-Alpha材料科学文献研究助手')
    expect(localizedServiceDescription(IDM_ID, '中文描述')).toBe('中文描述')
    expect(localizedServiceUsage(IDM_ID, '中文usage')).toBe('中文usage')
  })

  it('英文环境下命中映射返回英文', () => {
    setLocale('en-US')
    expect(localizedServiceName(IDM_ID, 'IDM-Alpha材料科学文献研究助手')).toBe(
      'IDM-Alpha Materials Science Literature Assistant',
    )
    expect(localizedServiceDescription(IDM_ID, '中文描述')).toContain('materials science')
    expect(localizedServiceUsage(IDM_ID, '中文usage')).toContain('Mode 1')
  })

  it('英文环境下未命中映射回退原文', () => {
    setLocale('en-US')
    expect(localizedServiceName('unknown-id', '某服务')).toBe('某服务')
    expect(localizedServiceUsage('unknown-id', '原文usage')).toBe('原文usage')
  })
})
