import { SETTINGS } from '../../data/settings'
import type { QualityLevel } from '../../data/zone'

export type QualityFallbackState = {
  belowThresholdSeconds: number
  droppedFromHigh: boolean
  droppedFromMedium: boolean
}

export type QualityFallbackInput = {
  fps: number
  deltaSeconds: number
  quality: QualityLevel
  qualityChosenByHand: boolean
  paused: boolean
  loading: boolean
  titleOpen: boolean
}

export function createQualityFallbackState(): QualityFallbackState {
  return {
    belowThresholdSeconds: 0,
    droppedFromHigh: false,
    droppedFromMedium: false,
  }
}

export function stepQualityFallback(
  state: QualityFallbackState,
  input: QualityFallbackInput,
): QualityLevel | null {
  if (
    input.qualityChosenByHand ||
    input.paused ||
    input.loading ||
    input.titleOpen ||
    input.quality === 'Low'
  ) {
    state.belowThresholdSeconds = 0
    return null
  }

  if (
    !Number.isFinite(input.fps) ||
    input.fps >= SETTINGS.quality.fallback.thresholdFps
  ) {
    state.belowThresholdSeconds = 0
    return null
  }

  if (!Number.isFinite(input.deltaSeconds) || input.deltaSeconds <= 0)
    return null

  state.belowThresholdSeconds += input.deltaSeconds
  if (
    state.belowThresholdSeconds + Number.EPSILON <
    SETTINGS.quality.fallback.durationSeconds
  )
    return null

  state.belowThresholdSeconds = 0
  if (input.quality === 'High') {
    if (state.droppedFromHigh) return null
    state.droppedFromHigh = true
    return 'Medium'
  }
  if (state.droppedFromMedium) return null
  state.droppedFromMedium = true
  return 'Low'
}

export function qualityFallbackToast(quality: QualityLevel): string {
  return `Graphics set to ${quality} for smoother play. Change it in Pause, Graphics.`
}
