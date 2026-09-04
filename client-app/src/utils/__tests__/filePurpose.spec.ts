import { describe, it, expect } from 'vitest'
import { filePurpose } from '../filePurpose'

describe('filePurpose', () => {
  it('identifies main report files', () => {
    expect(filePurpose('response.md')).toBe('主结果报告')
    expect(filePurpose('report-final.md')).toBe('主结果报告')
  })

  it('identifies common extensions', () => {
    expect(filePurpose('data.csv')).toContain('Excel')
    expect(filePurpose('chart.png')).toBe('图片/图表')
    expect(filePurpose('result.json')).toBe('结构化数据（JSON）')
    expect(filePurpose('archive.zip')).toBe('压缩打包文件')
    expect(filePurpose('notes.md')).toBe('Markdown 文档，可直接阅读')
  })

  it('falls back to mimeType when extension is unknown', () => {
    expect(filePurpose('output.bin', 'image/png')).toBe('图片/图表')
    expect(filePurpose('output.bin', 'application/pdf')).toBe('PDF 文档')
  })

  it('falls back to generic label', () => {
    expect(filePurpose('output.xyz')).toBe('输出文件')
    expect(filePurpose('')).toBe('输出文件')
  })
})
