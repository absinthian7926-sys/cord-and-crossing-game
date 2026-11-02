import { EFFECTS } from '../../data/effects'
import { audioBus, emitAudioEvent } from '../audio/audioBus'
import { getSceneRuntimeSnapshot } from '../scenes/sceneRuntime'
import { weaponRuntime } from '../weapons/weaponRuntime'
import {
  completeHollowHeelstonePass,
  getHollowRuntimeSnapshot,
} from '../hollow/hollowRuntime'
import {
  addEffectFromCrossing,
  carryEffectOnLine,
  clearEffects,
  createEffectSystem,
  getEffectRemainingSeconds,
  hasEffect,
  isLineCarrying,
  makeLinePlain,
  queryEffectMultipliers,
  tickEffects,
  type EffectMultipliers,
  type PlainLineReason,
} from './effects'
import {
  createHeelstonePassState,
  stepHeelstonePass,
  type HeelstonePassEvent,
  type HeelstonePassMode,
} from './heelstonePass'

export type EffectRuntimeSnapshot = {
  readonly revision: number
  readonly passMode: HeelstonePassMode
  readonly lineCarrying: boolean
}

type Listener = () => void

const listeners = new Set<Listener>()
const TICK_PASS_EVENT = { type: 'tick' } as const
let snapshot: EffectRuntimeSnapshot = {
  revision: 0,
  passMode: 'Idle',
  lineCarrying: false,
}

export const effectRuntime = {
  effects: createEffectSystem(),
  pass: createHeelstonePassState(),
  multipliers: {
    closeDamage: 1,
    castPullForce: 1,
    staggerDuration: 1,
    carriedCastDamage: 1,
    carriedCastBreaksGuard: false,
  } satisfies EffectMultipliers,
}

function refreshMultipliers(): void {
  queryEffectMultipliers(effectRuntime.effects, effectRuntime.multipliers)
}

function publish(): void {
  refreshMultipliers()
  snapshot = {
    revision: snapshot.revision + 1,
    passMode: effectRuntime.pass.mode,
    lineCarrying: isLineCarrying(effectRuntime.effects),
  }
  for (const listener of listeners) listener()
}

function emitHeelstoneModeTransition(
  previousMode: HeelstonePassMode,
  nextMode: HeelstonePassMode,
): void {
  if (previousMode === 'Idle' && nextMode === 'Passing') {
    emitAudioEvent(audioBus, 'heelstone-hiss-start')
  } else if (previousMode === 'Passing' && nextMode === 'Carried') {
    emitAudioEvent(audioBus, 'heelstone-chime')
  } else if (previousMode === 'Passing' && nextMode !== 'Passing') {
    emitAudioEvent(audioBus, 'heelstone-hiss-stop')
  }
}

export function getEffectRuntimeSnapshot(): EffectRuntimeSnapshot {
  return snapshot
}

export function subscribeEffectRuntime(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetEffectRuntime(): void {
  const previousMode = effectRuntime.pass.mode
  clearEffects(effectRuntime.effects)
  Object.assign(effectRuntime.pass, createHeelstonePassState())
  emitHeelstoneModeTransition(previousMode, effectRuntime.pass.mode)
  publish()
}

export function grantStrengthFromCrossing(isReturnCrossing: boolean): boolean {
  const added = addEffectFromCrossing(
    effectRuntime.effects,
    EFFECTS.strength,
    isReturnCrossing,
  )
  if (added) publish()
  return added
}

export function hasStrength(): boolean {
  return hasEffect(effectRuntime.effects, EFFECTS.strength.id)
}

export function getStrengthRemainingSeconds(): number {
  return getEffectRemainingSeconds(effectRuntime.effects, EFFECTS.strength.id)
}

export function startHeelstonePass(): boolean {
  const previous = effectRuntime.pass.mode
  stepHeelstonePass(effectRuntime.pass, {
    type: 'start',
    activeEffectId: hasStrength() ? EFFECTS.strength.id : null,
    bladeInHand: weaponRuntime.cord.mode === 'InHand',
    lineAlreadyCarrying: isLineCarrying(effectRuntime.effects),
  })
  if (effectRuntime.pass.mode === previous) return false
  emitHeelstoneModeTransition(previous, effectRuntime.pass.mode)
  publish()
  return true
}

function passEvent(event: HeelstonePassEvent): boolean {
  const previousMode = effectRuntime.pass.mode
  const previousEffect = effectRuntime.pass.effectId
  stepHeelstonePass(effectRuntime.pass, event)
  if (
    effectRuntime.pass.mode === previousMode &&
    effectRuntime.pass.effectId === previousEffect
  )
    return false
  emitHeelstoneModeTransition(previousMode, effectRuntime.pass.mode)
  publish()
  return true
}

export function interruptHeelstonePassByHit(): boolean {
  return passEvent({ type: 'hit' })
}

export function cancelHeelstonePassByDodge(): boolean {
  return passEvent({ type: 'dodge' })
}

export function makeCarriedLinePlain(reason: PlainLineReason): boolean {
  const changed = makeLinePlain(effectRuntime.effects, reason)
  const passChanged = passEvent({ type: reason })
  if (changed && !passChanged) publish()
  return changed || passChanged
}

export function clearEffectsOnDeath(): void {
  const previousMode = effectRuntime.pass.mode
  clearEffects(effectRuntime.effects)
  stepHeelstonePass(effectRuntime.pass, { type: 'death' })
  emitHeelstoneModeTransition(previousMode, effectRuntime.pass.mode)
  publish()
}

export function tickEffectRuntime(dtSeconds: number): void {
  const carriedId = effectRuntime.effects.carriedEffectId
  const expiredCount = tickEffects(effectRuntime.effects, dtSeconds)
  if (carriedId !== null && !hasEffect(effectRuntime.effects, carriedId)) {
    const previousMode = effectRuntime.pass.mode
    stepHeelstonePass(effectRuntime.pass, {
      type: 'effectExpired',
      effectId: carriedId,
    })
    emitHeelstoneModeTransition(previousMode, effectRuntime.pass.mode)
  }

  const previousMode = effectRuntime.pass.mode
  const effectId = effectRuntime.pass.effectId
  stepHeelstonePass(effectRuntime.pass, TICK_PASS_EVENT, dtSeconds)
  emitHeelstoneModeTransition(previousMode, effectRuntime.pass.mode)
  if (
    previousMode === 'Passing' &&
    effectRuntime.pass.mode === 'Carried' &&
    effectId !== null
  ) {
    carryEffectOnLine(effectRuntime.effects, effectId)
    if (
      getSceneRuntimeSnapshot().currentScene === 'hollow' &&
      !getHollowRuntimeSnapshot().progress.heelstonePassDone
    )
      completeHollowHeelstonePass()
  }
  if (expiredCount > 0 || previousMode !== effectRuntime.pass.mode) publish()
}

export function isHeelstonePassRunning(): boolean {
  return effectRuntime.pass.mode === 'Passing'
}

export function lineCarriesEffect(): boolean {
  return isLineCarrying(effectRuntime.effects)
}

export function getEffectMultipliers(): Readonly<EffectMultipliers> {
  return effectRuntime.multipliers
}

export function getActiveEffectCount(): number {
  return effectRuntime.effects.activeCount
}
