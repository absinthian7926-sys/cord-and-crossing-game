import { FEEL } from '../../data/feel'
import { PLAYER } from '../../data/player'
import { ZONE } from '../../data/zone'
import type { GameScene } from '../scenes/sceneRuntime'

export type FootstepSurface = 'dirt' | 'stone' | 'wood'

export type FootstepState = {
  elapsedSeconds: number
  wasGrounded: boolean
  sequence: number
}

export type FootstepInput = {
  deltaSeconds: number
  grounded: boolean
  dodging: boolean
  paused: boolean
  dead: boolean
  speedMetersPerSecond: number
  scene: GameScene
  x: number
  z: number
}

export type FootstepOutput = {
  step: boolean
  landing: boolean
  surface: FootstepSurface
  pitch: number
}

export function createFootstepState(initialGrounded = false): FootstepState {
  return { elapsedSeconds: 0, wasGrounded: initialGrounded, sequence: 0 }
}

export function createFootstepOutput(): FootstepOutput {
  return { step: false, landing: false, surface: 'dirt', pitch: 1 }
}

export function footstepIntervalSeconds(speedMetersPerSecond: number): number {
  const range = PLAYER.movement.runSpeed - PLAYER.movement.walkSpeed
  const amount = Math.min(
    1,
    Math.max(0, (speedMetersPerSecond - PLAYER.movement.walkSpeed) / range),
  )
  return (
    FEEL.footsteps.walkIntervalSeconds +
    (FEEL.footsteps.runIntervalSeconds - FEEL.footsteps.walkIntervalSeconds) *
      amount
  )
}

export function resolveFootstepSurface(
  scene: GameScene,
  x: number,
  z: number,
): FootstepSurface {
  if (scene === 'hollow') return 'stone'
  const shelter = ZONE.placeholders.waystation
  if (
    Math.abs(x - shelter.shelterCenter[0]) <= shelter.shelterSize[0] / 2 &&
    Math.abs(z - shelter.shelterCenter[1]) <= shelter.shelterSize[2] / 2
  )
    return 'wood'
  if (
    Math.hypot(
      x - ZONE.locations.E.center[0],
      z - ZONE.locations.E.center[1],
    ) <= FEEL.footsteps.ruinShelfRadiusMeters
  )
    return 'stone'
  return 'dirt'
}

function nextPitch(state: FootstepState): number {
  state.sequence += 1
  let value = Math.imul(state.sequence ^ FEEL.footsteps.seed, 1_664_525)
  value = (value + 1_013_904_223) >>> 0
  const centered = value / 4_294_967_295 - 0.5
  return 1 + centered * 2 * FEEL.footsteps.pitchVariation
}

export function stepFootsteps(
  state: FootstepState,
  input: FootstepInput,
  output: FootstepOutput,
): FootstepOutput {
  output.step = false
  output.landing = false
  output.pitch = 1
  if (input.paused) return output

  const landed = input.grounded && !state.wasGrounded
  state.wasGrounded = input.grounded
  if (input.dead || input.dodging) {
    state.elapsedSeconds = 0
    return output
  }
  output.surface = resolveFootstepSurface(input.scene, input.x, input.z)
  if (landed) {
    output.landing = true
    output.pitch = nextPitch(state)
  }
  if (!input.grounded) {
    state.elapsedSeconds = 0
    return output
  }
  if (
    !Number.isFinite(input.speedMetersPerSecond) ||
    input.speedMetersPerSecond <= FEEL.footsteps.minimumMovementSpeed
  ) {
    state.elapsedSeconds = 0
    return output
  }

  const delta = Number.isFinite(input.deltaSeconds)
    ? Math.max(0, input.deltaSeconds)
    : 0
  state.elapsedSeconds += delta
  const interval = footstepIntervalSeconds(input.speedMetersPerSecond)
  if (state.elapsedSeconds < interval) return output
  state.elapsedSeconds %= interval
  output.step = true
  output.pitch = nextPitch(state)
  return output
}
