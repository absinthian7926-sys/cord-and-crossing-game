import { beforeEach, describe, expect, it } from 'vitest'
import {
  activateEnemyScene,
  advanceRespawn,
  damageEnemy,
  enemyRuntime,
  fireEnemyArrow,
  getActiveEnemyScene,
  initializeEnemyRoster,
  isEnemySceneInitialized,
  resetEnemySceneRosters,
} from '../game/enemies/enemyRuntime'

const zoneSpawn = {
  id: 'zone-brigand',
  type: 'roadBrigand' as const,
  x: 20,
  z: -20,
}

const hollowSpawns = [
  {
    id: 'hollow-brigand',
    type: 'roadBrigand' as const,
    x: 0,
    z: -50,
    respawns: false,
  },
  {
    id: 'hollow-archer',
    type: 'brigandArcher' as const,
    x: 4,
    z: -54,
    respawns: false,
  },
]

describe('scene-specific enemy runtime', () => {
  beforeEach(() => resetEnemySceneRosters())

  it('preserves zone damage, death timers, and arrows across a Hollow round trip', () => {
    initializeEnemyRoster([zoneSpawn])
    damageEnemy(zoneSpawn.id, 60, { kind: 'shove' })
    advanceRespawn(37)
    expect(fireEnemyArrow(0, 1, 0, 5, 1, 0)).toBeGreaterThanOrEqual(0)
    const zoneRecord = enemyRuntime.records[0]
    const zoneArrowCount = enemyRuntime.arrows.active.reduce(
      (count, active) => count + active,
      0,
    )

    expect(activateEnemyScene('hollow')).toBe(true)
    expect(enemyRuntime.records).toHaveLength(0)
    initializeEnemyRoster(hollowSpawns)

    expect(activateEnemyScene('zone')).toBe(true)
    expect(getActiveEnemyScene()).toBe('zone')
    expect(enemyRuntime.records[0]).toBe(zoneRecord)
    expect(enemyRuntime.records[0].respawnElapsed).toBe(37)
    expect(
      enemyRuntime.arrows.active.reduce((count, active) => count + active, 0),
    ).toBe(zoneArrowCount)
  })

  it('initializes a Hollow encounter once and retains non-respawning deaths on re-entry', () => {
    expect(activateEnemyScene('hollow')).toBe(true)
    expect(isEnemySceneInitialized('hollow')).toBe(false)
    initializeEnemyRoster(hollowSpawns)
    expect(isEnemySceneInitialized('hollow')).toBe(true)
    damageEnemy(hollowSpawns[0].id, 60, { kind: 'shove' })
    const defeated = enemyRuntime.records[0]

    activateEnemyScene('zone')
    initializeEnemyRoster([zoneSpawn])
    activateEnemyScene('hollow')

    expect(enemyRuntime.records).toHaveLength(2)
    expect(enemyRuntime.records[0]).toBe(defeated)
    expect(enemyRuntime.records[0].phase).toBe('Dying')
    expect(enemyRuntime.records[0].respawns).toBe(false)
    expect(activateEnemyScene('hollow')).toBe(false)
  })
})
