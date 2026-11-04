import { beforeEach, describe, expect, it } from 'vitest'
import { CAMP_PROGRESS } from '../data/enemies'
import {
  acquireAttackToken,
  countAttackTokens,
} from '../game/enemies/attackTokens'
import {
  advanceCampEnemyBreakoff,
  beginCampEnemyBreakoff,
  endCampEnemyBreakoff,
  enemyRuntime,
  getCampEnemyBreakoffRemainingSeconds,
  initializeEnemyRoster,
  isCampEnemyBreakoffActiveFor,
  releaseCampEnemyRespawns,
  resetEnemySceneRosters,
} from '../game/enemies/enemyRuntime'

describe('camp leader defeat break-off', () => {
  beforeEach(() => {
    resetEnemySceneRosters()
    initializeEnemyRoster([
      { id: 'camp-roadBrigand-1', type: 'roadBrigand', x: 0, z: 0 },
      { id: 'camp-brigandArcher-1', type: 'brigandArcher', x: 1, z: 0 },
      { id: 'road-patrol-roadBrigand-1', type: 'roadBrigand', x: 2, z: 0 },
    ])
  })

  it('drops both attack-token kinds and suppresses only camp enemies', () => {
    acquireAttackToken(
      enemyRuntime.attackTokens,
      'camp-roadBrigand-1',
      'melee',
      false,
    )
    acquireAttackToken(
      enemyRuntime.attackTokens,
      'camp-brigandArcher-1',
      'ranged',
      false,
    )
    enemyRuntime.records[0].hp = 17

    beginCampEnemyBreakoff()

    expect(countAttackTokens(enemyRuntime.attackTokens, 'melee')).toBe(0)
    expect(countAttackTokens(enemyRuntime.attackTokens, 'ranged')).toBe(0)
    expect(isCampEnemyBreakoffActiveFor('camp-roadBrigand-1')).toBe(true)
    expect(isCampEnemyBreakoffActiveFor('camp-brigandArcher-1')).toBe(true)
    expect(isCampEnemyBreakoffActiveFor('road-patrol-roadBrigand-1')).toBe(
      false,
    )
    expect(enemyRuntime.records[0].state).toBe('Return')
    expect(enemyRuntime.records[0].hp).toBe(17)
    expect(enemyRuntime.records[0].preserveHpOnReturn).toBe(true)
  })

  it('ends after exactly 20 seconds or immediately when the key is taken', () => {
    beginCampEnemyBreakoff()
    advanceCampEnemyBreakoff(CAMP_PROGRESS.leaderDefeatBreakoffSeconds - 0.01)
    expect(isCampEnemyBreakoffActiveFor('camp-roadBrigand-1')).toBe(true)
    advanceCampEnemyBreakoff(0.01)
    expect(isCampEnemyBreakoffActiveFor('camp-roadBrigand-1')).toBe(false)

    beginCampEnemyBreakoff()
    releaseCampEnemyRespawns()
    expect(getCampEnemyBreakoffRemainingSeconds()).toBe(0)
    expect(isCampEnemyBreakoffActiveFor('camp-roadBrigand-1')).toBe(false)

    beginCampEnemyBreakoff()
    endCampEnemyBreakoff()
    expect(getCampEnemyBreakoffRemainingSeconds()).toBe(0)
  })

  it('does not advance while the shared gameplay delta is paused at zero', () => {
    beginCampEnemyBreakoff()
    advanceCampEnemyBreakoff(0)
    expect(getCampEnemyBreakoffRemainingSeconds()).toBe(
      CAMP_PROGRESS.leaderDefeatBreakoffSeconds,
    )
  })
})
