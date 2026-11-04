import { FEEL } from '../../data/feel'

export type EnemyFlashPhase = 'Idle' | 'Hold' | 'Return'

export type EnemyFlashState = {
  phase: EnemyFlashPhase
  remainingSeconds: number
  queued: boolean
}

export type TimedFlashState = {
  remainingSeconds: number
}

export function createEnemyFlashState(): EnemyFlashState {
  return { phase: 'Idle', remainingSeconds: 0, queued: false }
}

export function createTimedFlashState(): TimedFlashState {
  return { remainingSeconds: 0 }
}

function beginEnemyFlash(state: EnemyFlashState): void {
  state.phase = 'Hold'
  state.remainingSeconds = FEEL.hitFlash.enemy.holdSeconds
}

export function triggerEnemyHitFlash(
  state: EnemyFlashState,
  telegraphActive: boolean,
): void {
  if (telegraphActive) state.queued = true
  else beginEnemyFlash(state)
}

export function stepEnemyHitFlash(
  state: EnemyFlashState,
  deltaSeconds: number,
  telegraphActive: boolean,
): number {
  if (telegraphActive) {
    if (state.phase !== 'Idle') state.queued = true
    return 0
  }
  if (state.queued) {
    state.queued = false
    beginEnemyFlash(state)
  }
  if (state.phase === 'Idle') return 0

  let delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0
  if (state.phase === 'Hold') {
    if (delta <= state.remainingSeconds) {
      state.remainingSeconds -= delta
      return FEEL.hitFlash.enemy.mix
    }
    delta -= state.remainingSeconds
    state.phase = 'Return'
    state.remainingSeconds = FEEL.hitFlash.enemy.returnSeconds
  }

  state.remainingSeconds = Math.max(0, state.remainingSeconds - delta)
  if (state.remainingSeconds === 0) {
    state.phase = 'Idle'
    return 0
  }
  return (
    FEEL.hitFlash.enemy.mix *
    (state.remainingSeconds / FEEL.hitFlash.enemy.returnSeconds)
  )
}

export function triggerPlayerVignette(state: TimedFlashState): void {
  state.remainingSeconds = FEEL.hitFlash.player.durationSeconds
}

export function stepPlayerVignette(
  state: TimedFlashState,
  deltaSeconds: number,
  reduceMotion: boolean,
): number {
  state.remainingSeconds = Math.max(
    0,
    state.remainingSeconds -
      (Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0),
  )
  const peak =
    FEEL.hitFlash.player.peakOpacity *
    (reduceMotion ? FEEL.hitFlash.player.reducedMotionMultiplier : 1)
  return peak * (state.remainingSeconds / FEEL.hitFlash.player.durationSeconds)
}

export function triggerBlockFlash(state: TimedFlashState): void {
  state.remainingSeconds = FEEL.hitFlash.block.durationSeconds
}

export function stepBlockFlash(
  state: TimedFlashState,
  deltaSeconds: number,
): number {
  state.remainingSeconds = Math.max(
    0,
    state.remainingSeconds -
      (Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0),
  )
  return state.remainingSeconds > 0 ? 1 : 0
}
