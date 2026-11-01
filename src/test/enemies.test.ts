import { describe, expect, it } from 'vitest'
import {
  ENEMY_AI,
  ENEMY_ARROW,
  ENEMY_ATTACK,
  ENEMY_DEATH,
  ENEMY_SPAWNS,
  ENEMY_TYPES,
  PLAYER_DEATH,
} from '../data/enemies'

describe('enemy data', () => {
  it('matches the Road brigand GDD numbers', () => {
    expect(ENEMY_TYPES.roadBrigand).toMatchObject({
      displayName: 'Road brigand',
      maxHealth: 60,
      damage: 12,
      attackCadenceSeconds: 1.1,
      moveSpeed: 4.2,
      attackRange: 1.8,
      cordCutter: false,
      buckler: { blockChance: 0.5, frontalConeDegrees: 90 },
    })
  })

  it('matches the Brigand archer GDD numbers', () => {
    expect(ENEMY_TYPES.brigandArcher).toMatchObject({
      displayName: 'Brigand archer',
      maxHealth: 40,
      damage: 10,
      attackCadenceSeconds: 2.2,
      moveSpeed: 3.5,
      attackRange: 30,
      keepAway: { minimumDistance: 12, maximumDistance: 25 },
      drawSeconds: 0.6,
      fleeHealthFraction: 0.15,
      cordCutter: false,
    })
    expect(ENEMY_ARROW.maximumRange).toBe(30)
  })

  it('matches the Cliff hound GDD numbers', () => {
    expect(ENEMY_TYPES.cliffHound).toMatchObject({
      displayName: 'Cliff hound',
      maxHealth: 35,
      damage: 8,
      attackCadenceSeconds: 0.8,
      moveSpeed: 7,
      attackRange: 1.4,
      cordCutter: true,
      cutterVolumeRadius: 0.38,
    })
  })

  it('matches shared AI, spawn, death and projectile defaults', () => {
    expect(ENEMY_AI).toMatchObject({
      aggroRadius: 18,
      leashRadius: 40,
      safeZoneRadius: 25,
      alertSeconds: 0.6,
      patrolSpeedMultiplier: 0.5,
      patrolRadius: 15,
    })
    expect(ENEMY_ARROW).toEqual({
      speed: 35,
      gravity: 9.81,
      hitRadius: 0.15,
      poolSize: 16,
      lifetimeSeconds: 2,
      maximumRange: 30,
    })
    expect(ENEMY_SPAWNS.camp).toMatchObject({
      anchor: [380, -240],
      spreadRadius: 30,
      roadBrigands: 6,
      brigandArchers: 3,
    })
    expect(ENEMY_SPAWNS.houndPacks.map(({ size }) => size)).toEqual([3, 2])
    expect(ENEMY_SPAWNS.roadPatrol).toMatchObject({
      roadBrigands: 2,
      brigandArchers: 1,
      routeDistances: [150, 350],
    })
    expect(ENEMY_DEATH).toMatchObject({
      fallSeconds: 1,
      respawnSeconds: 300,
      respawnPlayerDistance: 40,
      healthBarSeconds: 4,
    })
  })

  it('keeps M4 guard break inert and uses the 0.4 s light stagger', () => {
    expect(ENEMY_ATTACK.breaksGuardByDefault).toBe(false)
    expect(ENEMY_ATTACK.castStaggerSeconds).toBe(0.4)
    expect(ENEMY_ATTACK.brigandComboStaggerHitIndex).toBe(2)
  })

  it('matches the waystation player death defaults', () => {
    expect(PLAYER_DEATH).toEqual({
      fadeSeconds: 1.5,
      spawn: [0, 8, 0],
      spawnInvulnerabilitySeconds: 2,
      respawnCordMode: 'InHand',
    })
  })
})
