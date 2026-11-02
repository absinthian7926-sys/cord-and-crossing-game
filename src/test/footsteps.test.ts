import { describe, expect, it } from 'vitest'
import { PLAYER } from '../data/player'
import { ZONE } from '../data/zone'
import {
  createFootstepOutput,
  createFootstepState,
  footstepIntervalSeconds,
  resolveFootstepSurface,
  stepFootsteps,
  type FootstepInput,
} from '../game/feel/footsteps'

const input = (overrides: Partial<FootstepInput> = {}): FootstepInput => ({
  deltaSeconds: 0,
  grounded: true,
  dodging: false,
  paused: false,
  dead: false,
  speedMetersPerSecond: PLAYER.movement.walkSpeed,
  scene: 'zone',
  x: 100,
  z: 100,
  ...overrides,
})

describe('footstep decisions', () => {
  it('interpolates cadence between walk and run', () => {
    expect(footstepIntervalSeconds(PLAYER.movement.walkSpeed)).toBe(0.5)
    expect(footstepIntervalSeconds(PLAYER.movement.runSpeed)).toBe(0.32)
    expect(
      footstepIntervalSeconds(
        (PLAYER.movement.walkSpeed + PLAYER.movement.runSpeed) / 2,
      ),
    ).toBeCloseTo(0.41)
    expect(footstepIntervalSeconds(0)).toBe(0.5)
    expect(footstepIntervalSeconds(100)).toBe(0.32)
  })

  it('emits no step while airborne, dodging, paused, dead or still', () => {
    const state = createFootstepState(true)
    const output = createFootstepOutput()
    for (const override of [
      { grounded: false },
      { dodging: true },
      { paused: true },
      { dead: true },
      { speedMetersPerSecond: 0 },
    ] satisfies Array<Partial<FootstepInput>>) {
      stepFootsteps(state, input({ deltaSeconds: 1, ...override }), output)
      expect(output.step).toBe(false)
    }
    stepFootsteps(
      state,
      input({ deltaSeconds: Number.NaN, speedMetersPerSecond: Number.NaN }),
      output,
    )
    expect(output.step).toBe(false)
  })

  it('emits a seeded step and a landing thud without allocation', () => {
    const state = createFootstepState(true)
    const output = createFootstepOutput()
    expect(stepFootsteps(state, input({ deltaSeconds: 0.5 }), output)).toBe(
      output,
    )
    expect(output.step).toBe(true)
    expect(output.pitch).toBeGreaterThanOrEqual(0.96)
    expect(output.pitch).toBeLessThanOrEqual(1.04)

    stepFootsteps(state, input({ grounded: false }), output)
    expect(output.landing).toBe(false)
    stepFootsteps(state, input({ grounded: true }), output)
    expect(output.landing).toBe(true)
  })

  it('classifies dirt, Ruin Shelf stone, Hollow stone and waystation wood', () => {
    expect(resolveFootstepSurface('zone', 100, 100)).toBe('dirt')
    expect(
      resolveFootstepSurface(
        'zone',
        ZONE.locations.E.center[0],
        ZONE.locations.E.center[1],
      ),
    ).toBe('stone')
    expect(resolveFootstepSurface('hollow', 0, 0)).toBe('stone')
    expect(
      resolveFootstepSurface(
        'zone',
        ZONE.placeholders.waystation.shelterCenter[0],
        ZONE.placeholders.waystation.shelterCenter[1],
      ),
    ).toBe('wood')
    expect(
      resolveFootstepSurface(
        'zone',
        ZONE.placeholders.waystation.shelterCenter[0],
        ZONE.placeholders.waystation.shelterCenter[1] + 20,
      ),
    ).toBe('dirt')
  })

  it('handles invalid and negative frame deltas without advancing', () => {
    const state = createFootstepState()
    const output = createFootstepOutput()
    stepFootsteps(state, input({ deltaSeconds: Number.NaN }), output)
    expect(output.step).toBe(false)
    stepFootsteps(state, input({ deltaSeconds: -1 }), output)
    expect(output.step).toBe(false)
  })
})
