import { FEEL } from '../../data/feel'

export type ShakeState = {
  trauma: number
  elapsedSeconds: number
  seed: number
}

export type ShakeOutput = {
  x: number
  y: number
  z: number
  rollRadians: number
}

const UINT32_MAX = 4_294_967_295

function hashNoise(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value ^= value >>> 16
  return (value / UINT32_MAX) * 2 - 1
}

export function sampleSmoothNoise(seed: number, time: number): number {
  const left = Math.floor(time)
  const amount = time - left
  const smooth = amount * amount * (3 - 2 * amount)
  const a = hashNoise(seed, left)
  return a + (hashNoise(seed, left + 1) - a) * smooth
}

export function createShakeState(seed = FEEL.shake.seed): ShakeState {
  return { trauma: 0, elapsedSeconds: 0, seed }
}

export function createShakeOutput(): ShakeOutput {
  return { x: 0, y: 0, z: 0, rollRadians: 0 }
}

function clearOutput(output: ShakeOutput): void {
  output.x = 0
  output.y = 0
  output.z = 0
  output.rollRadians = 0
}

export function addShakeTrauma(state: ShakeState, trauma: number): void {
  if (!Number.isFinite(trauma) || trauma <= 0) return
  state.trauma = Math.min(1, state.trauma + trauma)
}

export function stepShake(
  state: ShakeState,
  deltaSeconds: number,
  paused: boolean,
  reduceMotion: boolean,
  availableTranslationMeters: number,
  output: ShakeOutput,
): ShakeOutput {
  clearOutput(output)
  if (paused) return output

  const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0
  state.elapsedSeconds += delta
  state.trauma = Math.max(0, state.trauma - FEEL.shake.decayPerSecond * delta)
  if (reduceMotion || state.trauma <= 0) return output

  const amplitude = state.trauma * state.trauma
  const time = state.elapsedSeconds * FEEL.shake.noiseFrequencyHz
  output.x =
    sampleSmoothNoise(state.seed, time) * FEEL.shake.maxOffsetMeters * amplitude
  output.y =
    sampleSmoothNoise(state.seed + 1, time) *
    FEEL.shake.maxOffsetMeters *
    amplitude
  output.z =
    sampleSmoothNoise(state.seed + 2, time) *
    FEEL.shake.maxOffsetMeters *
    amplitude
  output.rollRadians =
    sampleSmoothNoise(state.seed + 3, time) *
    ((FEEL.shake.maxRollDegrees * Math.PI) / 180) *
    amplitude

  const allowance = Math.min(
    FEEL.shake.maxOffsetMeters,
    Math.max(0, availableTranslationMeters),
  )
  if (allowance === 0) {
    clearOutput(output)
    return output
  }
  const length = Math.hypot(output.x, output.y, output.z)
  if (length > allowance && length > 0) {
    const scale = allowance / length
    output.x *= scale
    output.y *= scale
    output.z *= scale
  }
  return output
}
