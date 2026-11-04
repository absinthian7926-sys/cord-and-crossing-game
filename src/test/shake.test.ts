import { describe, expect, it } from 'vitest'
import { FEEL } from '../data/feel'
import {
  addShakeTrauma,
  createShakeOutput,
  createShakeState,
  sampleSmoothNoise,
  stepShake,
} from '../game/feel/shake'

describe('camera shake', () => {
  it('adds trauma, caps at one and decays at 1.6 per second', () => {
    const state = createShakeState()
    addShakeTrauma(state, 0.35)
    expect(state.trauma).toBeCloseTo(0.35)
    addShakeTrauma(state, 2)
    expect(state.trauma).toBe(1)
    stepShake(state, 0.25, false, false, 1, createShakeOutput())
    expect(state.trauma).toBeCloseTo(0.6)
    addShakeTrauma(state, 0)
    addShakeTrauma(state, -1)
    addShakeTrauma(state, Number.NaN)
    expect(state.trauma).toBeCloseTo(0.6)
  })

  it('uses a deterministic smooth seeded signal and squared trauma', () => {
    expect(sampleSmoothNoise(17, 1.25)).toBe(sampleSmoothNoise(17, 1.25))
    expect(sampleSmoothNoise(17, 1.25)).not.toBe(sampleSmoothNoise(18, 1.25))
    const first = createShakeState(17)
    const second = createShakeState(17)
    first.trauma = 0.5
    second.trauma = 0.5
    const firstOutput = createShakeOutput()
    const secondOutput = createShakeOutput()
    expect(stepShake(first, 0, false, false, 1, firstOutput)).toBe(firstOutput)
    stepShake(second, 0, false, false, 1, secondOutput)
    expect(firstOutput).toEqual(secondOutput)
    expect(Math.abs(firstOutput.x)).toBeLessThanOrEqual(
      FEEL.shake.maxOffsetMeters * 0.25,
    )
  })

  it('freezes and applies no offset while paused or reduced', () => {
    const state = createShakeState()
    state.trauma = 0.8
    const output = createShakeOutput()
    stepShake(state, 1, true, false, 1, output)
    expect(state.trauma).toBe(0.8)
    expect(output).toEqual({ x: 0, y: 0, z: 0, rollRadians: 0 })

    stepShake(state, 0.25, false, true, 1, output)
    expect(state.trauma).toBeCloseTo(0.4)
    expect(output).toEqual({ x: 0, y: 0, z: 0, rollRadians: 0 })

    state.trauma = 0
    stepShake(state, Number.NaN, false, false, 1, output)
    expect(output).toEqual({ x: 0, y: 0, z: 0, rollRadians: 0 })
    stepShake(state, -1, false, false, 1, output)
    expect(state.elapsedSeconds).toBeCloseTo(0.25)
  })

  it('clamps translation to the resolved camera distance allowance', () => {
    const state = createShakeState()
    state.trauma = 1
    const output = createShakeOutput()
    stepShake(state, 0, false, false, 0.01, output)
    expect(Math.hypot(output.x, output.y, output.z)).toBeLessThanOrEqual(
      0.01 + Number.EPSILON,
    )
    stepShake(state, 0, false, false, -1, output)
    expect(output.x).toBe(0)
    expect(output.y).toBe(0)
    expect(output.z).toBe(0)
  })
})
