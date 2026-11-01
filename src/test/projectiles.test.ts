import { describe, expect, it } from 'vitest'
import { ENEMY_ARROW, ENEMY_TYPES } from '../data/enemies'
import {
  countActiveArrows,
  createArrowPool,
  launchArrow,
  stepArrows,
} from '../game/enemies/projectiles'

const lowGround = () => -1_000

describe('enemy arrow projectiles', () => {
  it('uses a fixed preallocated pool of 16 arrows', () => {
    const pool = createArrowPool()
    expect(pool.active).toHaveLength(ENEMY_ARROW.poolSize)
    for (let index = 0; index < ENEMY_ARROW.poolSize; index += 1) {
      expect(launchArrow(pool, 0, 10, 0, 30, 10, 0)).toBe(index)
    }
    expect(launchArrow(pool, 0, 10, 0, 30, 10, 0)).toBe(-1)
    expect(countActiveArrows(pool)).toBe(ENEMY_ARROW.poolSize)
  })

  it('flies at 35 m/s under gravity and despawns at 30 m', () => {
    const pool = createArrowPool()
    const arrow = launchArrow(pool, 0, 100, 0, 100, 100, 0)
    const initialVelocityY = pool.velocityY[arrow]
    expect(
      Math.hypot(
        pool.velocityX[arrow],
        pool.velocityY[arrow],
        pool.velocityZ[arrow],
      ),
    ).toBeCloseTo(ENEMY_ARROW.speed)
    stepArrows(pool, 0.5, -100, -100, -100, 0.36, false, lowGround)
    expect(pool.velocityY[arrow]).toBeCloseTo(
      initialVelocityY - ENEMY_ARROW.gravity * 0.5,
    )
    stepArrows(pool, 0.5, -100, -100, -100, 0.36, false, lowGround)
    expect(pool.active[arrow]).toBe(0)
    expect(pool.distanceTravelled[arrow]).toBeGreaterThanOrEqual(
      ENEMY_ARROW.maximumRange,
    )
  })

  it('applies archer damage on hit and dodge invulnerability avoids it', () => {
    const hitPool = createArrowPool()
    launchArrow(hitPool, 0, 1, 0, 1, 1, 0)
    expect(stepArrows(hitPool, 0, 0, 1, 0, 0.36, false, lowGround)).toBe(
      ENEMY_TYPES.brigandArcher.damage,
    )
    expect(countActiveArrows(hitPool)).toBe(0)

    const dodgePool = createArrowPool()
    launchArrow(dodgePool, 0, 1, 0, 1, 1, 0)
    expect(stepArrows(dodgePool, 0, 0, 1, 0, 0.36, true, lowGround)).toBe(0)
    expect(countActiveArrows(dodgePool)).toBe(0)
  })

  it('uses a swept hit test when the player is between frame endpoints', () => {
    const pool = createArrowPool()
    launchArrow(pool, 0, 10, 0, 30, 10, 0)
    expect(stepArrows(pool, 0.1, 1.75, 10, 0, 0.36, false, lowGround)).toBe(
      ENEMY_TYPES.brigandArcher.damage,
    )
    expect(countActiveArrows(pool)).toBe(0)
  })

  it.each([12, 25])(
    'uses a gravity-compensated low arc to hit a stationary player at %i m',
    (range) => {
      const pool = createArrowPool()
      launchArrow(pool, 0, 1, 0, range, 1, 0)
      let damage = 0
      for (
        let frame = 0;
        frame < 120 && countActiveArrows(pool) > 0;
        frame += 1
      ) {
        damage += stepArrows(pool, 1 / 60, range, 1, 0, 0.36, false, () => 0)
      }
      expect(damage).toBe(ENEMY_TYPES.brigandArcher.damage)
      expect(countActiveArrows(pool)).toBe(0)
    },
  )

  it('despawns when an arrow reaches terrain', () => {
    const pool = createArrowPool()
    const arrow = launchArrow(pool, 0, 1, 0, 10, 1, 0)
    stepArrows(pool, 0.5, 100, 100, 100, 0.36, false, () => 0)
    expect(pool.active[arrow]).toBe(0)
  })

  it('does not produce NaN when start and target match', () => {
    const pool = createArrowPool()
    const arrow = launchArrow(pool, 1, 2, 3, 1, 2, 3)
    stepArrows(pool, 1 / 60, 100, 100, 100, 0.36, false, lowGround)
    expect(Number.isFinite(pool.x[arrow])).toBe(true)
    expect(Number.isFinite(pool.y[arrow])).toBe(true)
    expect(Number.isFinite(pool.z[arrow])).toBe(true)
  })
})
