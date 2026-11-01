import { describe, expect, it } from 'vitest'
import { ENEMY_DEATH, ENEMY_SPAWNS } from '../data/enemies'
import {
  advanceRespawnElapsed,
  advanceRespawn,
  canRespawnFromElapsed,
  createRespawnState,
  createSpawnPlan,
  markEnemyDead,
} from '../game/enemies/spawns'

describe('enemy spawns', () => {
  it('matches the camp, hound pack and mixed road patrol counts', () => {
    const plan = createSpawnPlan()
    const camp = plan.filter(({ group }) => group === 'camp')
    expect(
      camp.filter(({ enemyType }) => enemyType === 'roadBrigand'),
    ).toHaveLength(ENEMY_SPAWNS.camp.roadBrigands)
    expect(
      camp.filter(({ enemyType }) => enemyType === 'brigandArcher'),
    ).toHaveLength(ENEMY_SPAWNS.camp.brigandArchers)
    expect(plan.filter(({ group }) => group === 'cliff-pack-1')).toHaveLength(3)
    expect(plan.filter(({ group }) => group === 'cliff-pack-2')).toHaveLength(2)
    const patrol = plan.filter(({ group }) => group === 'road-patrol')
    expect(
      patrol.filter(({ enemyType }) => enemyType === 'roadBrigand'),
    ).toHaveLength(2)
    expect(
      patrol.filter(({ enemyType }) => enemyType === 'brigandArcher'),
    ).toHaveLength(1)
    expect(plan).toHaveLength(17)
  })

  it('keeps all nine camp enemies within the 30 m spread', () => {
    for (const spawn of createSpawnPlan().filter(
      ({ group }) => group === 'camp',
    )) {
      expect(
        Math.hypot(
          spawn.x - ENEMY_SPAWNS.camp.anchor[0],
          spawn.z - ENEMY_SPAWNS.camp.anchor[1],
        ),
      ).toBeLessThanOrEqual(ENEMY_SPAWNS.camp.spreadRadius)
    }
  })

  it('builds a deterministic spawn plan', () => {
    expect(createSpawnPlan()).toEqual(createSpawnPlan())
  })

  it('respawns after exactly 300 seconds only when the player is over 40 m away', () => {
    const state = createRespawnState()
    markEnemyDead(state)
    expect(state.remainingSeconds).toBe(ENEMY_DEATH.respawnSeconds)
    expect(advanceRespawn(state, 299, 100)).toBe(false)
    expect(state.dead).toBe(true)
    expect(advanceRespawn(state, 1, ENEMY_DEATH.respawnPlayerDistance)).toBe(
      false,
    )
    expect(state.remainingSeconds).toBe(0)
    expect(advanceRespawn(state, 0, 40.001)).toBe(true)
    expect(state.dead).toBe(false)
    expect(advanceRespawn(state, 100, 100)).toBe(false)
  })

  it('counts the runtime respawn timer from the lethal hit through the fall', () => {
    let elapsed = advanceRespawnElapsed(0, 299)
    expect(canRespawnFromElapsed(elapsed, 100)).toBe(false)
    elapsed = advanceRespawnElapsed(elapsed, 1)
    expect(
      canRespawnFromElapsed(elapsed, ENEMY_DEATH.respawnPlayerDistance),
    ).toBe(false)
    expect(
      canRespawnFromElapsed(elapsed, ENEMY_DEATH.respawnPlayerDistance + 0.001),
    ).toBe(true)
  })
})
