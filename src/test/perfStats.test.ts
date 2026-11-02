import { describe, expect, it } from 'vitest'
import {
  createPerfFrameBuffer,
  createPerfSummary,
  pushFrameTime,
  samplePerfStats,
} from '../ui/perfStats'

describe('performance rolling statistics', () => {
  it('reports zeroes for an empty buffer and rejects invalid frames', () => {
    const defaultBuffer = createPerfFrameBuffer()
    expect(defaultBuffer.frameTimesMs).toHaveLength(600)
    expect(defaultBuffer.timestampsSeconds).toHaveLength(600)
    expect(defaultBuffer.sortScratchMs).toHaveLength(600)

    const buffer = createPerfFrameBuffer(4)
    const output = createPerfSummary()
    expect(pushFrameTime(buffer, 0, 0)).toBe(false)
    expect(pushFrameTime(buffer, Number.NaN, 0)).toBe(false)
    expect(pushFrameTime(buffer, 16, Number.POSITIVE_INFINITY)).toBe(false)
    expect(samplePerfStats(buffer, 10, output)).toBe(output)
    expect(output).toEqual({
      fps: 0,
      frameTimeMeanMs: 0,
      frameTimeP95Ms: 0,
      onePercentLowFps: 0,
    })
  })

  it('samples a partial buffer without allocating a new result', () => {
    const buffer = createPerfFrameBuffer(6)
    const output = createPerfSummary()
    expect(pushFrameTime(buffer, 10, 9.95)).toBe(true)
    expect(pushFrameTime(buffer, 20, 9.97)).toBe(true)
    expect(pushFrameTime(buffer, 30, 10)).toBe(true)

    expect(samplePerfStats(buffer, 10, output)).toBe(output)
    expect(output.fps).toBeCloseTo(50)
    expect(output.frameTimeMeanMs).toBeCloseTo(20)
    expect(output.frameTimeP95Ms).toBe(30)
    expect(output.onePercentLowFps).toBeCloseTo(1000 / 30)
  })

  it('wraps the full ring and excludes samples outside each window', () => {
    const buffer = createPerfFrameBuffer(4)
    const output = createPerfSummary()
    pushFrameTime(buffer, 10, 0)
    pushFrameTime(buffer, 20, 9)
    pushFrameTime(buffer, 30, 9.5)
    pushFrameTime(buffer, 40, 9.75)
    pushFrameTime(buffer, 50, 10)

    samplePerfStats(buffer, 10, output)
    expect(output.fps).toBeCloseTo(1000 / 35)
    expect(output.frameTimeMeanMs).toBeCloseTo(35)
    expect(output.frameTimeP95Ms).toBe(50)
    expect(output.onePercentLowFps).toBeCloseTo(20)

    samplePerfStats(buffer, 30, output)
    expect(output).toEqual({
      fps: 0,
      frameTimeMeanMs: 0,
      frameTimeP95Ms: 0,
      onePercentLowFps: 0,
    })
  })

  it('averages the slowest one percent and validates capacity', () => {
    expect(() => createPerfFrameBuffer(0)).toThrow('positive integer')
    expect(() => createPerfFrameBuffer(1.5)).toThrow('positive integer')

    const buffer = createPerfFrameBuffer(200)
    const output = createPerfSummary()
    for (let index = 0; index < 200; index += 1)
      pushFrameTime(buffer, index < 198 ? 10 : 50, 10 + index * 0.001)

    samplePerfStats(buffer, 10.2, output)
    expect(output.frameTimeP95Ms).toBe(10)
    expect(output.onePercentLowFps).toBe(20)
  })
})
