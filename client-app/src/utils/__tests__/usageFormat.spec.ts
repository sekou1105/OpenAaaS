import { describe, it, expect } from 'vitest'
import { marked } from 'marked'
import { formatUsageMarkdown } from '../usageFormat'

describe('formatUsageMarkdown', () => {
  it('restores escaped newlines', () => {
    expect(formatUsageMarkdown('第一行\\n第二行')).toBe('第一行\n第二行')
  })

  it('keeps real newlines untouched', () => {
    expect(formatUsageMarkdown('第一行\n第二行')).toBe('第一行\n第二行')
  })

  it('wraps bare field names in inline code', () => {
    expect(formatUsageMarkdown('请填写 task_prompt 字段')).toBe('请填写 `task_prompt` 字段')
    expect(formatUsageMarkdown('output_prompt 可选')).toBe('`output_prompt` 可选')
  })

  it('does not double-wrap fields already in backticks', () => {
    expect(formatUsageMarkdown('请填写 `task_prompt` 字段')).toBe('请填写 `task_prompt` 字段')
  })

  it('returns empty string for empty input', () => {
    expect(formatUsageMarkdown('')).toBe('')
  })

  it('inserts blank line so a table right after a paragraph parses', () => {
    const raw = '三种模式对比：\n| 模式 | 耗时 |\n| --- | --- |\n| 快速 | 5分钟 |'
    const html = marked.parse(formatUsageMarkdown(raw), { async: false, breaks: true }) as string
    expect(html).toContain('<table>')
    expect(html).toContain('<td>快速</td>')
  })

  it('inserts blank line so a list right after a paragraph parses', () => {
    const raw = '操作步骤：\n- 第一步\n- 第二步'
    const formatted = formatUsageMarkdown(raw)
    expect(formatted).toBe('操作步骤：\n\n- 第一步\n- 第二步')
  })

  it('does not split consecutive table rows or list items', () => {
    const raw = '| a | b |\n| c | d |'
    expect(formatUsageMarkdown(raw)).toBe(raw)
  })

  it('emphasizes pseudo numbered sections', () => {
    expect(formatUsageMarkdown('方式一：快速模式')).toBe('**方式一：快速模式**')
    expect(formatUsageMarkdown('模式 2: 深度报告')).toBe('**模式 2: 深度报告**')
    // 已有 Markdown 结构的不动
    expect(formatUsageMarkdown('# 方式一：快速模式')).toBe('# 方式一：快速模式')
  })

  it('handles code fences without breaking them apart', () => {
    const raw = '示例：\n```\ntask_prompt = "x"\n```'
    const html = marked.parse(formatUsageMarkdown(raw), { async: false }) as string
    expect(html).toContain('<code>')
  })

  it('transforms YAML block scalars into friendly labeled sections', () => {
    const raw = '使用方式：\ntask_prompt: |\n  描述你要执行的任务，\n  支持多行文本。\noutput_prompt: |\n  将结果写入 response.md。'
    const formatted = formatUsageMarkdown(raw)

    // 不再有裸露的 :| 语法
    expect(formatted).not.toContain(':|')
    expect(formatted).not.toContain(': |')
    // 字段转为中文友好加粗标签（字段名另行包裹为行内代码）
    expect(formatted).toMatch(/\*\*任务描述（`task_prompt`）：\*\*/)
    expect(formatted).toMatch(/\*\*输出要求（`output_prompt`）：\*\*/)
    // 块内容去缩进保留
    expect(formatted).toContain('描述你要执行的任务，')
    expect(formatted).toContain('将结果写入 response.md。')

    const html = marked.parse(formatted, { async: false, breaks: true }) as string
    expect(html).toContain('<strong>')
  })

  it('supports YAML folded style (key: >) and unknown keys', () => {
    const raw = 'extra_field: >\n  一些说明文字'
    const formatted = formatUsageMarkdown(raw)
    expect(formatted).toContain('**extra_field：**')
    expect(formatted).toContain('一些说明文字')
  })

  it('leaves non-YAML text unchanged by the YAML transformer', () => {
    const raw = '普通说明：冒号结尾的一行\n下一行内容'
    expect(formatUsageMarkdown(raw)).toContain('普通说明：冒号结尾的一行')
  })

  it('handles quoted keys, fullwidth colon and indent indicators', () => {
    expect(formatUsageMarkdown('"task_prompt": |\n  内容')).toContain('**任务描述（`task_prompt`）：**')
    expect(formatUsageMarkdown('task_prompt：|\n  内容')).toContain('**任务描述（`task_prompt`）：**')
    expect(formatUsageMarkdown('output_prompt: |2\n  内容')).toContain('**输出要求（`output_prompt`）：**')
  })

  it('handles empty-value key followed by indented block', () => {
    const raw = 'task_prompt:\n  第一行\n  第二行'
    const formatted = formatUsageMarkdown(raw)
    expect(formatted).toContain('**任务描述（`task_prompt`）：**')
    expect(formatted).toContain('第一行')
    expect(formatted).toContain('第二行')
  })

  it('handles multiple repeated YAML blocks (per-mode sections)', () => {
    const raw = [
      '方式一：',
      'task_prompt: |',
      '  模式一内容',
      'output_prompt: |',
      '  模式一输出',
      '',
      '方式二：',
      'task_prompt: |',
      '  模式二内容',
      'output_prompt: |',
      '  模式二输出',
    ].join('\n')
    const formatted = formatUsageMarkdown(raw)
    expect(formatted).not.toMatch(/:\s*[|>]/)
    expect(formatted.match(/\*\*任务描述/g)).toHaveLength(2)
    expect(formatted.match(/\*\*输出要求/g)).toHaveLength(2)
    expect(formatted).toContain('模式二输出')
  })

  it('does not swallow nested key lines into the previous block (IDM-Alpha regression)', () => {
    // 真实案例：第一个 key 顶格，后续同级 key 缩进书写
    const raw = [
      '示例：',
      'task_prompt: |',
      '  解释高熵合金抗氧化机理',
      '  ',
      '  output_prompt: |',
      '  ',
      '  ---',
      '  ',
      '  task_prompt: |',
      '  BaTiO3 陶瓷为什么具有铁电性？',
      '  input_files:|',
      '  - /path/to/query_result.json',
      '  output_prompt: |',
    ].join('\n')
    const formatted = formatUsageMarkdown(raw)

    // 所有同级 key 都转换为标签，不再裸露 :| 语法
    expect(formatted).not.toMatch(/:\s*[|>]/)
    expect(formatted.match(/\*\*任务描述/g)).toHaveLength(2)
    expect(formatted.match(/\*\*输出要求/g)).toHaveLength(2)
    expect(formatted).toContain('**input_files：**')
    expect(formatted).toContain('BaTiO3 陶瓷为什么具有铁电性？')
    expect(formatted).toContain('- /path/to/query_result.json')

    // --- 前有补空行，不会把上一行变成 setext 标题
    const html = marked.parse(formatted, { async: false, breaks: true }) as string
    expect(html).toContain('<hr')
    expect(html).not.toContain('<h2>')
  })

  it('dedents orphaned indented lines outside blocks', () => {
    const raw = 'task_prompt: |\n  内容\n  随后第二次任务：'
    const formatted = formatUsageMarkdown(raw)
    expect(formatted).toContain('\n随后第二次任务：')
  })
})
