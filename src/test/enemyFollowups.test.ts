import { beforeEach, describe, expect, it } from 'vitest'
import {
  enemyRuntime,
  initializeEnemyRoster,
  isWithinPlayerDeathResetRadius,
  resetEnemiesNearDeathToReturn,
} from '../game/enemies/enemyRuntime'

describe('nearby enemy reset on player death', () => {
  beforeEach(() => {
    initializeEnemyRoster([
      { id: 'inside', type: 'roadBrigand', x: 39, z: 0 },
      { id: 'boundary', type: 'roadBrigand', x: 40, z: 0 },
      { id: 'outside', type: 'roadBrigand', x: 41, z: 0 },
    ])
    for (const enemy of enemyRuntime.records) enemy.state = 'Chase'
  })

  it('defines the 40 m boundary as inclusive', () => {
    expect(isWithinPlayerDeathResetRadius(39, 0, 0, 0)).toBe(true)
    expect(isWithinPlayerDeathResetRadius(40, 0, 0, 0)).toBe(true)
    expect(isWithinPlayerDeathResetRadius(41, 0, 0, 0)).toBe(false)
  })

  it('forces only enemies within 40 m to Return', () => {
    resetEnemiesNearDeathToReturn(0, 0)
    expect(enemyRuntime.records[0].state).toBe('Return')
    expect(enemyRuntime.records[1].state).toBe('Return')
    expect(enemyRuntime.records[2].state).toBe('Chase')
    expect(enemyRuntime.records[2].hp).toBe(enemyRuntime.records[2].maxHp)
  })
})
