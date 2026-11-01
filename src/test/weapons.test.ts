import { describe, expect, it } from 'vitest'
import { REACHBLADE, TRAINING_DUMMIES } from '../data/weapons'

describe('reachblade training dummies', () => {
  it('keeps every dummy within straight-cast reach from the hand origin', () => {
    const handOriginX = 0.28
    const maximumCenterDistance =
      REACHBLADE.maxCordLength - REACHBLADE.bladeHitRadius

    for (const dummy of TRAINING_DUMMIES) {
      const distance = Math.hypot(
        dummy.position[0] - handOriginX,
        dummy.position[2],
      )
      expect(distance).toBeLessThanOrEqual(maximumCenterDistance)
    }
  })
})
