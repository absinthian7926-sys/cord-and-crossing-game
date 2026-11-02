export const PERF_FRAME_CAPACITY = 600

export type PerfFrameBuffer = {
  readonly frameTimesMs: Float64Array
  readonly timestampsSeconds: Float64Array
  readonly sortScratchMs: Float64Array
  head: number
  count: number
}

export type PerfSummary = {
  fps: number
  frameTimeMeanMs: number
  frameTimeP95Ms: number
  onePercentLowFps: number
}

export function createPerfFrameBuffer(
  capacity = PERF_FRAME_CAPACITY,
): PerfFrameBuffer {
  if (!Number.isInteger(capacity) || capacity <= 0)
    throw new Error('Performance frame capacity must be a positive integer.')
  return {
    frameTimesMs: new Float64Array(capacity),
    timestampsSeconds: new Float64Array(capacity),
    sortScratchMs: new Float64Array(capacity),
    head: 0,
    count: 0,
  }
}

export function createPerfSummary(): PerfSummary {
  return {
    fps: 0,
    frameTimeMeanMs: 0,
    frameTimeP95Ms: 0,
    onePercentLowFps: 0,
  }
}

export function pushFrameTime(
  buffer: PerfFrameBuffer,
  frameTimeMs: number,
  timestampSeconds: number,
): boolean {
  if (
    !Number.isFinite(frameTimeMs) ||
    frameTimeMs <= 0 ||
    !Number.isFinite(timestampSeconds)
  )
    return false

  buffer.frameTimesMs[buffer.head] = frameTimeMs
  buffer.timestampsSeconds[buffer.head] = timestampSeconds
  buffer.head = (buffer.head + 1) % buffer.frameTimesMs.length
  buffer.count = Math.min(buffer.count + 1, buffer.frameTimesMs.length)
  return true
}

export function samplePerfStats(
  buffer: PerfFrameBuffer,
  nowSeconds: number,
  output: PerfSummary,
): PerfSummary {
  let oneSecondFrames = 0
  let oneSecondMilliseconds = 0
  let tenSecondCount = 0
  let tenSecondMilliseconds = 0
  const oneSecondStart = nowSeconds - 1
  const tenSecondStart = nowSeconds - 10
  const capacity = buffer.frameTimesMs.length
  const oldest = (buffer.head - buffer.count + capacity) % capacity

  for (let offset = 0; offset < buffer.count; offset += 1) {
    const index = (oldest + offset) % capacity
    const timestamp = buffer.timestampsSeconds[index]
    if (timestamp < tenSecondStart) continue
    const frameTime = buffer.frameTimesMs[index]
    buffer.sortScratchMs[tenSecondCount] = frameTime
    tenSecondCount += 1
    tenSecondMilliseconds += frameTime
    if (timestamp >= oneSecondStart) {
      oneSecondFrames += 1
      oneSecondMilliseconds += frameTime
    }
  }

  output.fps =
    oneSecondMilliseconds > 0
      ? (oneSecondFrames * 1_000) / oneSecondMilliseconds
      : 0

  if (tenSecondCount === 0) {
    output.frameTimeMeanMs = 0
    output.frameTimeP95Ms = 0
    output.onePercentLowFps = 0
    return output
  }

  buffer.sortScratchMs.fill(
    Number.POSITIVE_INFINITY,
    tenSecondCount,
    buffer.sortScratchMs.length,
  )
  buffer.sortScratchMs.sort()
  output.frameTimeMeanMs = tenSecondMilliseconds / tenSecondCount
  output.frameTimeP95Ms =
    buffer.sortScratchMs[Math.max(0, Math.ceil(tenSecondCount * 0.95) - 1)]

  const slowFrameCount = Math.max(1, Math.ceil(tenSecondCount * 0.01))
  let slowFrameMilliseconds = 0
  for (
    let index = tenSecondCount - slowFrameCount;
    index < tenSecondCount;
    index += 1
  )
    slowFrameMilliseconds += buffer.sortScratchMs[index]
  output.onePercentLowFps =
    (slowFrameCount * 1_000) / slowFrameMilliseconds
  return output
}
