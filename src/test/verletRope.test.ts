import { describe, expect, it } from 'vitest'
import { REACHBLADE } from '../data/weapons'
import {
  createVerletRope,
  ropeLength,
  stepVerletRope,
} from '../game/weapons/verletRope'

describe('verlet rope', () => {
  it('keeps pinned endpoints and segment lengths within tolerance', () => {
    const hand = { x: 0, y: 1, z: 0 }
    const blade = { x: 0, y: 1, z: -6 }
    const rope = createVerletRope(hand, blade)
    for (let index = 0; index < 120; index += 1)
      stepVerletRope(rope, 1 / 60, hand, blade, 'Out')
    expect(Array.from(rope.positions.slice(0, 3))).toEqual([0, 1, 0])
    const end = (rope.pointCount - 1) * 3
    expect(rope.positions[end]).toBe(0)
    expect(rope.positions[end + 1]).toBe(1)
    expect(rope.positions[end + 2]).toBe(-6)
    expect(ropeLength(rope)).toBeLessThanOrEqual(
      REACHBLADE.maxCordLength + 0.03,
    )
  })

  it('settles a dropped working end on the ground', () => {
    const hand = { x: 0, y: 1, z: 0 }
    const blade = { x: 0, y: 1, z: -4 }
    const rope = createVerletRope(hand, blade)
    for (let index = 0; index < 600; index += 1)
      stepVerletRope(rope, 1 / 60, hand, blade, 'Dropped')
    const endY = rope.positions[(rope.pointCount - 1) * 3 + 1]
    expect(endY).toBeCloseTo(REACHBLADE.rope.groundHeight, 2)
    expect(ropeLength(rope)).toBeLessThanOrEqual(
      REACHBLADE.maxCordLength + 0.05,
    )
  })

  it('renders only the hand-end stub when cut and never produces NaN', () => {
    const hand = { x: 0, y: 1, z: 0 }
    const blade = { x: 0, y: 1, z: -4 }
    const rope = createVerletRope(hand, blade)
    stepVerletRope(rope, 1 / 60, hand, blade, 'Cut')
    expect(rope.activePoints).toBe(REACHBLADE.rope.cutVisiblePoints)
    for (const value of rope.positions)
      expect(Number.isFinite(value)).toBe(true)
  })
})
