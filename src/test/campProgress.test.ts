import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CAMP_PROGRESS, ENEMY_DEATH } from '../data/enemies'
import {
  addDeadCampEnemyId,
  isCampQuestActive,
  isStandardCampEnemyId,
  removeDeadCampEnemyId,
  resolveCampDeathRespawn,
  shouldHoldCampRespawn,
  shouldSetCampCheckpoint,
} from '../game/enemies/campProgress'
import {
  advanceRespawn,
  canEnemyRespawn,
  completeEnemyReturn,
  damageEnemy,
  ensureCampLeaderSpawned,
  getEnemyRecord,
  initializeEnemyRoster,
  releaseCampEnemyRespawns,
  resetEnemiesNearDeathToReturn,
  resetEnemySceneRosters,
  restoreCampEnemyDeaths,
} from '../game/enemies/enemyRuntime'
import { canRespawnFromElapsed } from '../game/enemies/spawns'
import {
  emitQuestEvent,
  getQuestRuntimeSnapshot,
  resetQuestRuntime,
} from '../game/quest/questRuntime'

describe('camp progress rules', () => {
  it('holds standard camp deaths during step 2 and releases them after the key', () => {
    expect(isCampQuestActive(2, false)).toBe(true)
    expect(isCampQuestActive(1, false)).toBe(false)
    expect(isCampQuestActive(2, true)).toBe(false)
    expect(shouldHoldCampRespawn('camp-roadBrigand-1', 2, false)).toBe(true)
    expect(shouldHoldCampRespawn('camp-brigandArcher-3', 2, false)).toBe(true)
    expect(shouldHoldCampRespawn('camp-roadBrigand-1', 3, true)).toBe(false)
    expect(shouldHoldCampRespawn('camp-leader', 2, false)).toBe(false)
  })

  it('recognizes only the stable nine standard camp ids', () => {
    expect(isStandardCampEnemyId('camp-roadBrigand-1')).toBe(true)
    expect(isStandardCampEnemyId('camp-roadBrigand-6')).toBe(true)
    expect(isStandardCampEnemyId('camp-brigandArcher-1')).toBe(true)
    expect(isStandardCampEnemyId('camp-brigandArcher-3')).toBe(true)
    expect(isStandardCampEnemyId('camp-roadBrigand-0')).toBe(false)
    expect(isStandardCampEnemyId('camp-roadBrigand-7')).toBe(false)
    expect(isStandardCampEnemyId('camp-brigandArcher-4')).toBe(false)
    expect(isStandardCampEnemyId('road-patrol-roadBrigand-1')).toBe(false)
  })

  it('sets the checkpoint at 45 m inclusively but not at 46 m', () => {
    expect(shouldSetCampCheckpoint(2, false, 45)).toBe(true)
    expect(shouldSetCampCheckpoint(2, false, 46)).toBe(false)
    expect(shouldSetCampCheckpoint(1, false, 0)).toBe(false)
    expect(shouldSetCampCheckpoint(2, true, 0)).toBe(false)
  })

  it('uses the road checkpoint only after it has been activated', () => {
    const target = { x: 0, z: 0 }
    expect(resolveCampDeathRespawn(target, true, 9, 10)).toBe(target)
    expect(target).toEqual({
      x: CAMP_PROGRESS.respawn[0],
      z: CAMP_PROGRESS.respawn[1],
    })
    resolveCampDeathRespawn(target, false, 9, 10)
    expect(target).toEqual({ x: 9, z: 10 })
  })

  it('adds and removes unique valid dead ids without changing no-op inputs', () => {
    const empty: readonly string[] = []
    const one = addDeadCampEnemyId(empty, 'camp-roadBrigand-1')
    expect(one).toEqual(['camp-roadBrigand-1'])
    expect(addDeadCampEnemyId(one, 'camp-roadBrigand-1')).toBe(one)
    expect(addDeadCampEnemyId(one, 'camp-leader')).toBe(one)
    expect(removeDeadCampEnemyId(one, 'missing')).toBe(one)
    expect(removeDeadCampEnemyId(one, 'camp-roadBrigand-1')).toEqual([])
  })
})

describe('camp progress runtime', () => {
  beforeEach(() => {
    resetQuestRuntime()
    resetEnemySceneRosters()
    initializeEnemyRoster([
      {
        id: 'camp-roadBrigand-1',
        type: 'roadBrigand',
        x: 380,
        z: -240,
      },
    ])
    expect(emitQuestEvent('talkedToHollen')).toBe(true)
  })

  afterEach(() => {
    resetQuestRuntime()
    resetEnemySceneRosters()
  })

  it('holds a step 2 camp death, then starts a fresh 300 s timer after key pickup', () => {
    const enemy = getEnemyRecord('camp-roadBrigand-1')
    expect(enemy).toBeDefined()
    if (!enemy) return

    expect(damageEnemy(enemy.id, enemy.maxHp, { kind: 'shove' }).killed).toBe(
      true,
    )
    expect(getQuestRuntimeSnapshot().deadCampEnemyIds).toEqual([enemy.id])
    advanceRespawn(ENEMY_DEATH.respawnSeconds)
    expect(canEnemyRespawn(enemy)).toBe(false)

    expect(emitQuestEvent('keyLooted')).toBe(true)
    releaseCampEnemyRespawns()
    expect(enemy.respawnElapsed).toBe(0)
    expect(canEnemyRespawn(enemy)).toBe(true)
    advanceRespawn(ENEMY_DEATH.respawnSeconds - 1)
    expect(canRespawnFromElapsed(enemy.respawnElapsed, 100)).toBe(false)
    advanceRespawn(1)
    expect(canRespawnFromElapsed(enemy.respawnElapsed, 100)).toBe(true)
  })

  it('returns the leader after player death without healing its current HP', () => {
    const leaderId = ensureCampLeaderSpawned({
      questStep: 2,
      keyLooted: false,
      leaderDefeated: false,
    })
    expect(leaderId).toBe('camp-leader')
    const leader = getEnemyRecord('camp-leader')
    expect(leader).toBeDefined()
    if (!leader) return
    damageEnemy(leader.id, 40, { kind: 'shove' })
    expect(leader.hp).toBe(80)

    resetEnemiesNearDeathToReturn(0, 0)
    expect(leader.state).toBe('Return')
    expect(leader.preserveHpOnReturn).toBe(true)
    completeEnemyReturn(leader)
    expect(leader.hp).toBe(80)
    expect(leader.preserveHpOnReturn).toBe(true)
    completeEnemyReturn(leader)
    expect(leader.hp).toBe(80)
    leader.state = 'Idle'
    completeEnemyReturn(leader)
    expect(leader.hp).toBe(80)
    expect(leader.preserveHpOnReturn).toBe(false)
  })

  it('restores saved camp deaths as held dead records', () => {
    restoreCampEnemyDeaths(['camp-roadBrigand-1'], true)
    expect(getEnemyRecord('camp-roadBrigand-1')).toMatchObject({
      hp: 0,
      phase: 'Dead',
      campRespawnHeld: true,
    })
  })
})
