import {
  AnimationMixer,
  LoopOnce,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three'
import type { HeroStrikePhase } from './heroAnimation'

export type AnimationController = {
  readonly mixer: AnimationMixer
  readonly actions: ReadonlyMap<string, AnimationAction>
  currentClipId: string | null
  currentAction: AnimationAction | null
}

export type HeroWeaponAnimationState = {
  strikePhase: HeroStrikePhase
  comboHitIndex: 1 | 2 | 3
  casting: boolean
  aiming: boolean
  recalling: boolean
}

export type AnimationRuntimeSnapshot = {
  heroClipId: string | null
  heroTimeSeconds: number
  heroTimeScale: number
  lastEnemyClipId: string | null
  hollenClipId: string | null
  activeControllers: number
}

const heroWeaponState: HeroWeaponAnimationState = {
  strikePhase: 'idle',
  comboHitIndex: 1,
  casting: false,
  aiming: false,
  recalling: false,
}

const snapshot: AnimationRuntimeSnapshot = {
  heroClipId: null,
  heroTimeSeconds: 0,
  heroTimeScale: 1,
  lastEnemyClipId: null,
  hollenClipId: null,
  activeControllers: 0,
}

function loops(clipId: string): boolean {
  return (
    clipId === 'idle' ||
    clipId === 'run' ||
    clipId === 'walk' ||
    clipId === 'talk'
  )
}

export function createAnimationController(
  root: Object3D,
  clips: readonly AnimationClip[],
): AnimationController {
  const mixer = new AnimationMixer(root)
  const actions = new Map<string, AnimationAction>()
  for (const clip of clips) {
    const action = mixer.clipAction(clip)
    if (!loops(clip.name)) {
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
    }
    actions.set(clip.name, action)
  }
  snapshot.activeControllers += 1
  return {
    mixer,
    actions,
    currentClipId: null,
    currentAction: null,
  }
}

export function destroyAnimationController(
  controller: AnimationController | null,
): void {
  if (!controller) return
  controller.mixer.stopAllAction()
  controller.mixer.uncacheRoot(controller.mixer.getRoot())
  snapshot.activeControllers = Math.max(0, snapshot.activeControllers - 1)
}

export function stepAnimationController(
  controller: AnimationController | null,
  clipId: string | null,
  deltaSeconds: number,
  timeScale: number,
  crossfadeSeconds: number,
  normalizedTime: number | null = null,
  holdLastPose = false,
): void {
  if (!controller) return
  if (clipId === null) {
    if (controller.currentAction) controller.currentAction.paused = holdLastPose
    return
  }
  const next = controller.actions.get(clipId)
  if (!next) return

  if (controller.currentAction !== next) {
    const previous = controller.currentAction
    const stopPassImmediately = controller.currentClipId === 'heelstonePass'
    if (previous) {
      if (stopPassImmediately) previous.stop()
      else previous.fadeOut(crossfadeSeconds)
    }
    next.reset()
    next.enabled = true
    next.setEffectiveWeight(1)
    next.setEffectiveTimeScale(timeScale)
    next.paused = normalizedTime !== null
    if (previous && !stopPassImmediately) next.fadeIn(crossfadeSeconds)
    next.play()
    controller.currentAction = next
    controller.currentClipId = clipId
  }

  next.setEffectiveTimeScale(timeScale)
  next.paused = normalizedTime !== null
  if (normalizedTime !== null)
    next.time =
      Math.min(1, Math.max(0, normalizedTime)) * next.getClip().duration
  controller.mixer.update(Math.max(0, deltaSeconds))
}

export function setHeroWeaponAnimationState(
  strikePhase: HeroStrikePhase,
  comboHitIndex: 1 | 2 | 3,
  casting: boolean,
  aiming: boolean,
  recalling: boolean,
): void {
  heroWeaponState.strikePhase = strikePhase
  heroWeaponState.comboHitIndex = comboHitIndex
  heroWeaponState.casting = casting
  heroWeaponState.aiming = aiming
  heroWeaponState.recalling = recalling
}

export function resetHeroWeaponAnimationState(): void {
  setHeroWeaponAnimationState('idle', 1, false, false, false)
}

export function getHeroWeaponAnimationState(): Readonly<HeroWeaponAnimationState> {
  return heroWeaponState
}

export function recordHeroAnimation(
  controller: AnimationController | null,
  clipId: string | null,
  timeScale: number,
): void {
  snapshot.heroClipId = clipId
  snapshot.heroTimeSeconds = controller?.currentAction?.time ?? 0
  snapshot.heroTimeScale = timeScale
}

export function recordEnemyAnimation(clipId: string | null): void {
  snapshot.lastEnemyClipId = clipId
}

export function recordHollenAnimation(clipId: string | null): void {
  snapshot.hollenClipId = clipId
}

export function getAnimationRuntimeSnapshot(): Readonly<AnimationRuntimeSnapshot> {
  return snapshot
}
