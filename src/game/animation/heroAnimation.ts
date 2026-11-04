import { FEEL } from '../../data/feel'
import type { HeelstonePassMode } from '../effects/heelstonePass'

export type HeroClipId =
  | 'idle'
  | 'run'
  | 'dodge'
  | 'strike1'
  | 'strike2'
  | 'strike3'
  | 'cast'
  | 'recall'
  | 'heelstonePass'

export type HeroStrikePhase = 'idle' | 'windup' | 'active' | 'recovery'

export type HeroAnimationInput = {
  dead: boolean
  dodging: boolean
  heelstonePassMode: HeelstonePassMode
  heelstonePassRemainingSeconds: number
  strikePhase: HeroStrikePhase
  comboHitIndex: 1 | 2 | 3
  casting: boolean
  aiming: boolean
  recalling: boolean
  grounded: boolean
  speedMetersPerSecond: number
  running: boolean
}

export type HeroAnimationSelection = {
  clipId: HeroClipId | null
  timeScale: number
  crossfadeSeconds: number
  normalizedTime: number | null
  holdLastPose: boolean
}

export function createHeroAnimationSelection(): HeroAnimationSelection {
  return {
    clipId: 'idle',
    timeScale: 1,
    crossfadeSeconds: FEEL.animation.crossfadeSeconds,
    normalizedTime: null,
    holdLastPose: false,
  }
}

function resetSelection(output: HeroAnimationSelection): void {
  output.clipId = 'idle'
  output.timeScale = 1
  output.crossfadeSeconds = FEEL.animation.crossfadeSeconds
  output.normalizedTime = null
  output.holdLastPose = false
}

export function selectHeroAnimation(
  input: HeroAnimationInput,
  output: HeroAnimationSelection,
): HeroAnimationSelection {
  resetSelection(output)
  if (input.dead) {
    output.clipId = null
    output.holdLastPose = true
    return output
  }
  if (input.dodging) {
    output.clipId = 'dodge'
    return output
  }
  if (input.heelstonePassMode === 'Passing') {
    output.clipId = 'heelstonePass'
    output.normalizedTime = Math.min(
      1,
      Math.max(
        0,
        1 -
          input.heelstonePassRemainingSeconds /
            FEEL.animation.heelstonePassDurationSeconds,
      ),
    )
    return output
  }
  if (input.strikePhase !== 'idle') {
    output.clipId =
      input.comboHitIndex === 1
        ? 'strike1'
        : input.comboHitIndex === 2
          ? 'strike2'
          : 'strike3'
    return output
  }
  if (input.casting || input.aiming) {
    output.clipId = 'cast'
    return output
  }
  if (input.recalling) {
    output.clipId = 'recall'
    return output
  }
  if (
    input.grounded &&
    input.speedMetersPerSecond > FEEL.animation.movementEpsilon
  ) {
    output.clipId = 'run'
    output.timeScale = input.running ? 1 : FEEL.animation.walkTimeScale
  }
  return output
}
