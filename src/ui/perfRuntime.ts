import type { QualityLevel } from '../data/zone'
import type { GameScene } from '../game/scenes/sceneRuntime'

export type PerfStats = {
  fps: number
  frameTimeMeanMs: number
  frameTimeP95Ms: number
  onePercentLowFps: number
  drawCalls: number
  triangles: number
  qualityTier: QualityLevel
  devicePixelRatio: number
  scene: GameScene
  renderer: string
}

export const perfRuntime: PerfStats = {
  fps: 0,
  frameTimeMeanMs: 0,
  frameTimeP95Ms: 0,
  onePercentLowFps: 0,
  drawCalls: 0,
  triangles: 0,
  qualityTier: 'Medium',
  devicePixelRatio: 1,
  scene: 'zone',
  renderer: 'unknown',
}

let resetRevision = 0

export function getPerfStats(): PerfStats {
  return {
    fps: perfRuntime.fps,
    frameTimeMeanMs: perfRuntime.frameTimeMeanMs,
    frameTimeP95Ms: perfRuntime.frameTimeP95Ms,
    onePercentLowFps: perfRuntime.onePercentLowFps,
    drawCalls: perfRuntime.drawCalls,
    triangles: perfRuntime.triangles,
    qualityTier: perfRuntime.qualityTier,
    devicePixelRatio: perfRuntime.devicePixelRatio,
    scene: perfRuntime.scene,
    renderer: perfRuntime.renderer,
  }
}

export function setPerfQualityTier(qualityTier: QualityLevel): void {
  perfRuntime.qualityTier = qualityTier
}

export function requestPerfStatsReset(): void {
  resetRevision += 1
}

export function getPerfStatsResetRevision(): number {
  return resetRevision
}
