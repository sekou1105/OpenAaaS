/**
 * 输出文件用途推断：根据文件名与 MIME 类型给出用户可读的用途说明。
 * 纯展示层启发式，帮助用户理解每个输出文件是做什么的。
 */

const NAME_RULES: [RegExp, string][] = [
  [/^(response|result|report|summary|答案|报告|结果)/i, '主结果报告'],
  [/readme/i, '说明文档'],
  [/manifest|index/i, '清单/索引文件'],
  [/log/i, '运行日志'],
  [/config|setting/i, '配置文件'],
]

/** 数据/媒体/代码类扩展名：语义明确，优先于文件名猜测 */
const TYPED_EXT_RULES: [RegExp, string][] = [
  [/\.(csv|tsv)$/i, '表格数据，可用 Excel 打开'],
  [/\.(xlsx|xls)$/i, 'Excel 表格'],
  [/\.json$/i, '结构化数据（JSON）'],
  [/\.(png|jpe?g|gif|webp|bmp)$/i, '图片/图表'],
  [/\.svg$/i, '矢量图表'],
  [/\.(mp4|mov|avi|webm)$/i, '视频文件'],
  [/\.(mp3|wav|flac|ogg)$/i, '音频文件'],
  [/\.(zip|tar|gz|7z|rar)$/i, '压缩打包文件'],
  [/\.(py|rs|ts|js|java|go|c|cpp|sh)$/i, '代码/脚本文件'],
]

const EXT_RULES: [RegExp, string][] = [
  [/\.md$/i, 'Markdown 文档，可直接阅读'],
  [/\.pdf$/i, 'PDF 文档'],
  [/\.html?$/i, '网页文件，可用浏览器打开'],
  [/\.(txt|text)$/i, '纯文本文件'],
  [/\.(docx?|wps)$/i, 'Word 文档'],
  [/\.(pptx?|ppt)$/i, '演示文稿'],
]

export function filePurpose(filename: string, mimeType?: string): string {
  const name = filename.trim()
  if (!name) return '输出文件'

  for (const [re, purpose] of TYPED_EXT_RULES) {
    if (re.test(name)) return purpose
  }
  for (const [re, purpose] of NAME_RULES) {
    if (re.test(name)) return purpose
  }
  for (const [re, purpose] of EXT_RULES) {
    if (re.test(name)) return purpose
  }
  if (mimeType) {
    if (mimeType.startsWith('image/')) return '图片/图表'
    if (mimeType.startsWith('video/')) return '视频文件'
    if (mimeType.startsWith('audio/')) return '音频文件'
    if (mimeType.startsWith('text/')) return '文本文件'
    if (mimeType === 'application/json') return '结构化数据（JSON）'
    if (mimeType === 'application/pdf') return 'PDF 文档'
  }
  return '输出文件'
}
