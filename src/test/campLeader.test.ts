import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CAMP_LEADER,
  ENEMY_SPAWNS,
  ENEMY_TYPES,
  ENEMY_VARIANTS,
} from '../data/enemies'
import {
  canEnemyRespawn,
  damageEnemy,
  enemyRuntime,
  ensureCampLeaderSpawned,
  getEnemyRecord,
  initializeEnemyRoster,
  registerCampLeaderDefeatedHandler,
} from '../game/enemies/enemyRuntime'
import {
  canSpawnCampLeader,
  createCampLeaderSpawn,
} from '../game/enemies/spawns'

describe('camp leader quest variant', () => {
  beforeEach(() => initializeEnemyRoster([]))
  afterEach(() => registerCampLeaderDefeatedHandler(null))

  it('inherits Road brigand combat while using the M5 quest defaults', () => {
    expect(CAMP_LEADER).toMatchObject({
      displayName: 'Camp leader',
      baseType: 'roadBrigand',
      maxHealth: 120,
      scale: 1.15,
      campOffset: [0, 4],
      minimumQuestStep: 2,
      respawns: false,
      sashColor: '#9f493e',
    })
    const base = ENEMY_TYPES[CAMP_LEADER.baseType]
    expect(base.damage).toBe(12)
    expect(base.attackCadenceSeconds).toBe(1.1)
    expect(base.attackWindupSeconds).toBe(0.5)
    expect(base.moveSpeed).toBe(4.2)
    expect(base.buckler.blockChance).toBe(0.5)
    expect(base.light).toBe(false)
  })

  it('is eligible only from step 2 while undefeated and before key loot', () => {
    expect(
      canSpawnCampLeader({
        questStep: 1,
        keyLooted: false,
        leaderDefeated: false,
      }),
    ).toBe(false)
    expect(
      canSpawnCampLeader({
        questStep: 2,
        keyLooted: false,
        leaderDefeated: false,
      }),
    ).toBe(true)
    expect(
      canSpawnCampLeader({
        questStep: 6,
        keyLooted: true,
        leaderDefeated: false,
      }),
    ).toBe(false)
    expect(
      canSpawnCampLeader({
        questStep: 2,
        keyLooted: false,
        leaderDefeated: true,
      }),
    ).toBe(false)
  })

  it('creates one Road brigand variant at the camp fire offset', () => {
    const state = {
      questStep: 2,
      keyLooted: false,
      leaderDefeated: false,
    }
    const spawn = createCampLeaderSpawn(state)
    expect(spawn).toMatchObject({
      id: 'camp-leader',
      enemyType: 'roadBrigand',
      variant: ENEMY_VARIANTS.campLeader,
      group: 'camp',
      x: ENEMY_SPAWNS.camp.anchor[0],
      z: ENEMY_SPAWNS.camp.anchor[1] + 4,
    })

    expect(ensureCampLeaderSpawned(state)).toBe('camp-leader')
    expect(ensureCampLeaderSpawned(state)).toBe('camp-leader')
    const leaders = enemyRuntime.records.filter(
      (enemy) => enemy.variant === ENEMY_VARIANTS.campLeader,
    )
    expect(leaders).toHaveLength(1)
    expect(leaders[0]).toMatchObject({
      type: 'roadBrigand',
      hp: 120,
      maxHp: 120,
      scale: 1.15,
      respawns: false,
    })
  })

  it('emits one key-drop callback on death and never respawns', () => {
    ensureCampLeaderSpawned({
      questStep: 2,
      keyLooted: false,
      leaderDefeated: false,
    })
    const leader = getEnemyRecord('camp-leader')
    expect(leader).toBeDefined()
    if (!leader) return
    const onDefeated = vi.fn()
    registerCampLeaderDefeatedHandler(onDefeated)

    expect(
      damageEnemy(leader.id, CAMP_LEADER.maxHealth, { kind: 'shove' }).killed,
    ).toBe(true)
    expect(onDefeated).toHaveBeenCalledOnce()
    expect(onDefeated).toHaveBeenCalledWith(
      leader.id,
      leader.x,
      leader.y,
      leader.z,
    )
    expect(enemyRuntime.campLeaderDefeated).toBe(true)
    expect(canEnemyRespawn(leader)).toBe(false)
    expect(
      ensureCampLeaderSpawned({
        questStep: 2,
        keyLooted: false,
        leaderDefeated: false,
      }),
    ).toBeNull()
  })
})
