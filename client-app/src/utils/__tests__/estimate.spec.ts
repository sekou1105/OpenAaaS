import { describe, it, expect } from 'vitest'
import { estimateDurations, formatSeconds } from '../estimate'

describe('estimateDurations', () => {
  it('returns null for empty samples', () => {
    expect(estimateDurations([])).toBeNull()
    expect(estimateDurations([0, -5, NaN])).toBeNull()
  })

  it('computes avg and p90 for samples', () => {
    const est = estimateDurations([60, 120, 180, 240, 3000])
    expect(est?.sampleCount).toBe(5)
    expect(est?.avgSeconds).toBe(720)
    // 排序后 [60,120,180,240,3000]，ceil(5*0.9)-1 = 4 → p90 = 3000
    expect(est?.p90Seconds).toBe(3000)
  })

  it('single sample: avg equals p90', () => {
    const est = estimateDurations([3661])
    expect(est?.avgSeconds).toBe(3661)
    expect(est?.p90Seconds).toBe(3661)
  })
})

describe('formatSeconds', () => {
  it('formats seconds/minutes/hours consistently', () => {
    expect(formatSeconds(45)).toBe('45秒')
    expect(formatSeconds(75)).toBe('1分15秒')
    expect(formatSeconds(3600)).toBe('1小时0分')
    expect(formatSeconds(3661)).toBe('1小时1分')
  })
})
