/**
 * 服务使用说明（usage）的 Markdown 预处理：
 * 服务端文本通常是"半结构化"文本（换行被转义、块级结构前缺空行、
 * 伪编号列表等），直接交给 marked 会出现表格/列表不解析的问题。
 * 这里先做规范化，再交给 marked + DOMPurify 渲染。
 */

const KNOWN_FIELDS = ['task_prompt', 'output_prompt']

/** 已知字段的中文友好标签 */
const FIELD_LABELS: Record<string, string> = {
  task_prompt: '任务描述',
  output_prompt: '输出要求',
}

/** YAML 块标量键行：task_prompt: | / "output_prompt": >- / task_prompt：|2 / task_prompt: （空值+缩进块）等 */
const YAML_BLOCK_KEY_RE = /^\s*["']?([A-Za-z_][\w.-]*)["']?\s*[:：]\s*(?:[|>][+-]?\d*|\d[+-]?)?\s*$/
const YAML_BLOCK_KEY_RE_MULTILINE = new RegExp(YAML_BLOCK_KEY_RE.source, 'm')

/**
 * 检测并转换 YAML 块标量写法（key: | + 缩进多行内容）。
 * 服务端 usage 常见这种 YAML 片段，直接当 Markdown 渲染会裸露 `:|`，
 * 这里转换为「加粗标签 + 去缩进正文段落」的友好格式。
 */
function transformYamlBlocks(text: string): string {
  if (!YAML_BLOCK_KEY_RE_MULTILINE.test(text)) return text

  const lines = text.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const m = lines[i].match(YAML_BLOCK_KEY_RE)
    if (!m) {
      // 块外的游离缩进行（如原块内的 ---、说明文字）：去掉 1~3 格小缩进，
      // 避免渲染异常；4 格以上的缩进（Markdown 代码块）保持不变
      out.push(lines[i].replace(/^[ \t]{1,3}(?=\S)/, ''))
      i++
      continue
    }

    const key = m[1]
    const label = FIELD_LABELS[key] ? `${FIELD_LABELS[key]}（${key}）` : key
    out.push(`**${label}：**`)
    i++

    // 收集块内容：缩进行与块内空行。
    // 但缩进的「同级键行」或 YAML 文档分隔符（---）属于后续结构，不能吞进当前块。
    const block: string[] = []
    while (i < lines.length) {
      const line = lines[i]
      if (line.trim() === '') {
        block.push(line)
        i++
        continue
      }
      if (!/^[ \t]+\S/.test(line)) break
      if (YAML_BLOCK_KEY_RE.test(line) || /^\s*---\s*$/.test(line)) break
      block.push(line)
      i++
    }

    // 去掉公共缩进
    const nonBlank = block.filter((l) => l.trim() !== '')
    const indent = nonBlank.length
      ? Math.min(...nonBlank.map((l) => (l.match(/^[ \t]*/)?.[0].length ?? 0)))
      : 0
    const dedented = block.map((l) => (l.trim() === '' ? '' : l.slice(indent)))
    while (dedented.length > 0 && dedented[dedented.length - 1] === '') dedented.pop()

    if (dedented.length > 0) {
      out.push('')
      out.push(...dedented)
      out.push('')
    }
  }

  return out.join('\n')
}

/** 伪编号小节标题：方式一：xxx / 模式1: xxx / 示例二 - xxx / 步骤 3：xxx */
const PSEUDO_HEADING_RE = /^(\s*)(方式|模式|示例|步骤|阶段)\s*([一二三四五六七八九十0-9]+)\s*[：:．.、-]/

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line)
}

function isListItem(line: string): boolean {
  return /^\s*(-|\*|\+|\d+[.、)])\s+/.test(line)
}

function isHeading(line: string): boolean {
  return /^\s*#{1,6}\s/.test(line)
}

function isBlockquote(line: string): boolean {
  return /^\s*>\s?/.test(line)
}

function isCodeFence(line: string): boolean {
  return /^\s*```/.test(line)
}

/** Markdown 水平分隔线：--- / *** / ___（前无空行时 --- 会被误判为 setext 标题） */
function isThematicBreak(line: string): boolean {
  return /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)
}

/**
 * 块级结构（表格/列表/标题/引用/代码块）与前一行之间缺空行时补一个，
 * 否则 marked 会把它们当作上一段的普通文本而不解析。
 */
function ensureBlankLineBeforeBlocks(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let inFence = false

  for (const line of lines) {
    const prev = out.length > 0 ? out[out.length - 1] : ''

    if (isCodeFence(line)) {
      // 仅代码块的开始围栏需要补空行；结束围栏紧跟代码内容
      if (!inFence && prev !== '' && prev.trim() !== '') {
        out.push('')
      }
      inFence = !inFence
      out.push(line)
      continue
    }

    if (!inFence && prev.trim() !== '') {
      if (isTableRow(line) && !isTableRow(prev)) {
        out.push('')
      } else if (isListItem(line) && !isListItem(prev) && !PSEUDO_HEADING_RE.test(prev)) {
        out.push('')
      } else if ((isHeading(line) || isBlockquote(line)) && !isHeading(prev) && !isBlockquote(prev)) {
        out.push('')
      } else if (isThematicBreak(line) && !isThematicBreak(prev)) {
        out.push('')
      }
    }

    out.push(line)
  }

  return out.join('\n')
}

/** 「方式一：」「模式 2：」这类伪编号行升级为加粗小节，视觉上区分开 */
function emphasizePseudoHeadings(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (!PSEUDO_HEADING_RE.test(line)) return line
      const trimmed = line.trim()
      // 已是 Markdown 结构（标题/列表/加粗）则不动
      if (/^([#>*-]|\*\*)/.test(trimmed)) return line
      return `**${trimmed}**`
    })
    .join('\n')
}

export function formatUsageMarkdown(raw: string): string {
  if (!raw) return ''
  let text = raw

  // 1. 统一换行符；服务端存储时换行可能被转义为字面量 "\n"
  text = text.replace(/\r\n/g, '\n')
  if (!text.includes('\n') && text.includes('\\n')) {
    text = text.replace(/\\n/g, '\n')
  }

  // 2. YAML 块标量（key: | + 缩进内容）转换为加粗标签 + 正文段落
  text = transformYamlBlocks(text)

  // 3. 已知字段名的裸文本自动包裹为行内代码，避免以普通文字裸露
  for (const field of KNOWN_FIELDS) {
    const re = new RegExp(`(?<!\`)${field}(?!\`)`, 'g')
    text = text.replace(re, `\`${field}\``)
  }

  // 4. 块级结构前补空行，保证表格/列表/代码块被 marked 正确解析
  text = ensureBlankLineBeforeBlocks(text)

  // 5. 伪编号小节加粗，区分不同使用方式
  text = emphasizePseudoHeadings(text)

  return text
}
