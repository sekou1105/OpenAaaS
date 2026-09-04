/**
 * 任务耗时估算：基于同服务历史已完成任务的实际耗时，
 * 计算均值与 P90，为进行中任务提供「预计完成时间」参考。
 * 纯前端启发式，服务端日后提供 estimated_duration 字段时可整体替换。
 */

export interface DurationEstimate {
  /** 历史样本数 */
  sampleCount: number
  /** 平均耗时（秒） */
  avgSeconds: number
  /** P90 耗时（秒），90% 的历史任务在此时间内完成 */
  p90Seconds: number
}

/** 由一组耗时样本（秒）计算估算结果；样本为空返回 null */
export function estimateDurations(samples: number[]): DurationEstimate | null {
  const valid = samples.filter((s) => Number.isFinite(s) && s > 0)
  if (valid.length === 0) return null
  valid.sort((a, b) => a - b)
  const avg = valid.reduce((sum, s) => sum + s, 0) / valid.length
  const p90Index = Math.min(valid.length - 1, Math.ceil(valid.length * 0.9) - 1)
  return {
    sampleCount: valid.length,
    avgSeconds: Math.round(avg),
    p90Seconds: Math.round(valid[p90Index]),
  }
}

/** 与任务视图一致的耗时长文案：X秒 / X分X秒 / X小时X分 */
export function formatSeconds(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds))
  if (sec < 60) return `${sec}秒`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分${sec % 60}秒`
  const h = Math.floor(min / 60)
  return `${h}小时${min % 60}分`
}
