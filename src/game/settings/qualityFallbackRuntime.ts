export type QualityFallbackRuntimeSnapshot = {
  measuredFps: number
  forcedFps: number | null
  lastAutomaticTier: string | null
}

export const qualityFallbackRuntime: QualityFallbackRuntimeSnapshot = {
  measuredFps: 0,
  forcedFps: null,
  lastAutomaticTier: null,
}

export function setForcedQualityFps(fps: number | null): void {
  qualityFallbackRuntime.forcedFps =
    fps === null || !Number.isFinite(fps) ? null : Math.max(0, fps)
}

export function getQualityFallbackRuntimeSnapshot(): Readonly<QualityFallbackRuntimeSnapshot> {
  return qualityFallbackRuntime
}
