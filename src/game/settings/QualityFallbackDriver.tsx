import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { SETTINGS } from '../../data/settings'
import { getPauseRuntimeSnapshot } from '../pause/pauseRuntime'
import { getSceneRuntimeSnapshot } from '../scenes/sceneRuntime'
import {
  createQualityFallbackState,
  qualityFallbackToast,
  stepQualityFallback,
  type QualityFallbackInput,
} from './qualityFallback'
import { getSettingsRuntime } from './settingsRuntime'
import { showToast } from '../../ui/toastRuntime'
import { qualityFallbackRuntime } from './qualityFallbackRuntime'

export function QualityFallbackDriver() {
  const fallback = useRef(createQualityFallbackState())
  const input = useRef<QualityFallbackInput>({
    fps: 0,
    deltaSeconds: 0,
    quality: 'Medium',
    qualityChosenByHand: false,
    paused: false,
    loading: false,
    titleOpen: false,
  })
  const sampleElapsed = useRef(0)
  const frames = useRef(0)

  useFrame((_, deltaSeconds) => {
    const pause = getPauseRuntimeSnapshot()
    const scene = getSceneRuntimeSnapshot()
    const settingsRuntime = getSettingsRuntime()
    const settings = settingsRuntime.store.getState()
    const inactive =
      pause.open ||
      pause.titleOpen ||
      scene.phase === 'flashing' ||
      scene.phase === 'loading'

    if (inactive) {
      sampleElapsed.current = 0
      frames.current = 0
      input.current.fps = 0
      input.current.deltaSeconds = 0
      input.current.quality = settings.quality
      input.current.qualityChosenByHand = settings.qualityChosenByHand
      input.current.paused = pause.open
      input.current.loading = scene.phase !== 'idle'
      input.current.titleOpen = pause.titleOpen
      stepQualityFallback(fallback.current, input.current)
      return
    }

    sampleElapsed.current += deltaSeconds
    frames.current += 1
    if (sampleElapsed.current < 1) return
    const elapsedSeconds = sampleElapsed.current
    const measuredFps = frames.current / elapsedSeconds
    qualityFallbackRuntime.measuredFps = measuredFps
    input.current.fps = qualityFallbackRuntime.forcedFps ?? measuredFps
    input.current.deltaSeconds = elapsedSeconds
    input.current.quality = settings.quality
    input.current.qualityChosenByHand = settings.qualityChosenByHand
    input.current.paused = false
    input.current.loading = false
    input.current.titleOpen = false
    const nextTier = stepQualityFallback(fallback.current, input.current)
    sampleElapsed.current = 0
    frames.current = 0
    if (nextTier === null) return
    settings.setQuality(nextTier)
    qualityFallbackRuntime.lastAutomaticTier = nextTier
    showToast(
      qualityFallbackToast(nextTier),
      SETTINGS.quality.fallback.toastSeconds,
    )
  })

  return null
}
