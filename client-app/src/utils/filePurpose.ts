/**
 * 输出文件用途推断：根据文件名与 MIME 类型给出用户可读的用途说明。
 * 纯展示层启发式，帮助用户理解每个输出文件是做什么的。
 * 文案经 i18n 解析，随界面语言切换。
 */

import { i18n } from '@/i18n'

const NAME_RULES: [RegExp, string][] = [
  [/^(response|result|report|summary|答案|报告|结果)/i, 'report'],
  [/readme/i, 'readme'],
  [/manifest|index/i, 'manifest'],
  [/log/i, 'log'],
  [/config|setting/i, 'config'],
]

/** 数据/媒体/代码类扩展名：语义明确，优先于文件名猜测 */
const TYPED_EXT_RULES: [RegExp, string][] = [
  [/\.(csv|tsv)$/i, 'csv'],
  [/\.(xlsx|xls)$/i, 'excel'],
  [/\.json$/i, 'json'],
  [/\.(png|jpe?g|gif|webp|bmp)$/i, 'image'],
  [/\.svg$/i, 'svg'],
  [/\.(mp4|mov|avi|webm)$/i, 'video'],
  [/\.(mp3|wav|flac|ogg)$/i, 'audio'],
  [/\.(zip|tar|gz|7z|rar)$/i, 'archive'],
  [/\.(py|rs|ts|js|java|go|c|cpp|sh)$/i, 'code'],
]

const EXT_RULES: [RegExp, string][] = [
  [/\.md$/i, 'md'],
  [/\.pdf$/i, 'pdf'],
  [/\.html?$/i, 'html'],
  [/\.(txt|text)$/i, 'txt'],
  [/\.(docx?|wps)$/i, 'word'],
  [/\.(pptx?|ppt)$/i, 'ppt'],
]

function text(key: string): string {
  return i18n.global.t(`filePurpose.${key}`)
}

export function filePurpose(filename: string, mimeType?: string): string {
  const name = filename.trim()
  if (!name) return text('output')

  for (const [re, key] of TYPED_EXT_RULES) {
    if (re.test(name)) return text(key)
  }
  for (const [re, key] of NAME_RULES) {
    if (re.test(name)) return text(key)
  }
  for (const [re, key] of EXT_RULES) {
    if (re.test(name)) return text(key)
  }
  if (mimeType) {
    if (mimeType.startsWith('image/')) return text('image')
    if (mimeType.startsWith('video/')) return text('video')
    if (mimeType.startsWith('audio/')) return text('audio')
    if (mimeType.startsWith('text/')) return text('text')
    if (mimeType === 'application/json') return text('json')
    if (mimeType === 'application/pdf') return text('pdf')
  }
  return text('output')
}
