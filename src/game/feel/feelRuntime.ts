import { FEEL } from '../../data/feel'
import type { QualityLevel } from '../../data/zone'
import {
  createTimedFlashState,
  stepPlayerVignette,
  triggerPlayerVignette,
} from './hitFlash'
import type { PostEffectId } from './postQuality'
import {
  addShakeTrauma,
  createShakeOutput,
  createShakeState,
  stepShake,
  type ShakeOutput,
} from './shake'

export type FeelRuntimeSnapshot = {
  trauma: number
  offsetX: number
  offsetY: number
  offsetZ: number
  rollRadians: number
  playerVignetteOpacity: number
  playerFlashCount: number
  enemyFlashCount: number
  blockFlashCount: number
  postTier: QualityLevel
  postEffects: readonly PostEffectId[]
}

export type FeelDebugSnapshot = {
  trauma: number
  offset: {
    x: number
    y: number
    z: number
    rollRadians: number
  }
  flashes: {
    playerOpacity: number
    playerCount: number
    enemyCount: number
    blockCount: number
  }
  post: {
    tier: QualityLevel
    effects: PostEffectId[]
  }
}

const EMPTY_EFFECTS: readonly PostEffectId[] = []
const shakeState = createShakeState()
const shakeOutput = createShakeOutput()
const playerVignette = createTimedFlashState()
const playerVignetteListeners = new Set<() => void>()
const runtime: FeelRuntimeSnapshot = {
  trauma: 0,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  rollRadians: 0,
  playerVignetteOpacity: 0,
  playerFlashCount: 0,
  enemyFlashCount: 0,
  blockFlashCount: 0,
  postTier: 'Low',
  postEffects: EMPTY_EFFECTS,
}

function copyShakeOutput(output: Readonly<ShakeOutput>): void {
  runtime.trauma = shakeState.trauma
  runtime.offsetX = output.x
  runtime.offsetY = output.y
  runtime.offsetZ = output.z
  runtime.rollRadians = output.rollRadians
}

export function getFeelRuntimeSnapshot(): Readonly<FeelRuntimeSnapshot> {
  return runtime
}

export function addFeelTrauma(amount: number): void {
  addShakeTrauma(shakeState, amount)
  runtime.trauma = shakeState.trauma
}

export function triggerPlayerHitFeedback(): void {
  addFeelTrauma(FEEL.shake.trauma.playerHit)
  triggerPlayerVignette(playerVignette)
  runtime.playerFlashCount += 1
  for (const listener of playerVignetteListeners) listener()
}

export function subscribePlayerHitVignette(listener: () => void): () => void {
  playerVignetteListeners.add(listener)
  return () => playerVignetteListeners.delete(listener)
}

export function recordEnemyHitFlash(): void {
  runtime.enemyFlashCount += 1
}

export function recordBlockFlash(): void {
  runtime.blockFlashCount += 1
}

export function stepFeelShake(
  deltaSeconds: number,
  paused: boolean,
  reduceMotion: boolean,
  availableTranslationMeters: number,
): Readonly<ShakeOutput> {
  const output = stepShake(
    shakeState,
    deltaSeconds,
    paused,
    reduceMotion,
    availableTranslationMeters,
    shakeOutput,
  )
  copyShakeOutput(output)
  return output
}

export function stepPlayerHitVignette(
  deltaSeconds: number,
  reduceMotion: boolean,
): number {
  runtime.playerVignetteOpacity = stepPlayerVignette(
    playerVignette,
    deltaSeconds,
    reduceMotion,
  )
  return runtime.playerVignetteOpacity
}

export function setPostProcessingState(
  tier: QualityLevel,
  effects: readonly PostEffectId[],
): void {
  runtime.postTier = tier
  runtime.postEffects = effects
}

export function getFeelDebugSnapshot(): FeelDebugSnapshot {
  return {
    trauma: runtime.trauma,
    offset: {
      x: runtime.offsetX,
      y: runtime.offsetY,
      z: runtime.offsetZ,
      rollRadians: runtime.rollRadians,
    },
    flashes: {
      playerOpacity: runtime.playerVignetteOpacity,
      playerCount: runtime.playerFlashCount,
      enemyCount: runtime.enemyFlashCount,
      blockCount: runtime.blockFlashCount,
    },
    post: {
      tier: runtime.postTier,
      effects: [...runtime.postEffects],
    },
  }
}
