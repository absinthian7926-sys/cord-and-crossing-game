import { describe, expect, it } from 'vitest'
import {
  ENEMY_AI,
  ENEMY_ARROW,
  ENEMY_ATTACK,
  ENEMY_DEATH,
  ENEMY_PRESENTATION,
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
      attackWindupSeconds: 0.5,
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
      attackWindupSeconds: 0.35,
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
      playerDeathResetRadius: 40,
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
      releaseHeight: 0.45,
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

  it('keeps placeholder enemy presentation numbers in typed data', () => {
    expect(ENEMY_PRESENTATION).toEqual({
      stagger: { angularFrequency: 80, maximumRotationRadians: 0.09 },
      meleeWindup: {
        tintColor: '#c9a46a',
        brigandSwordRaiseRadians: Math.PI * 0.5,
        houndCrouchScaleY: 0.65,
      },
      arrow: {
        width: 0.025,
        height: 0.025,
        length: 0.65,
        color: '#5e4b35',
        roughness: 0.9,
      },
      hound: {
        bodyCapSegments: 6,
        bodyRadialSegments: 10,
        bodyRoughness: 0.95,
        headPosition: [0, 0.08, -0.48],
        headRadius: 0.22,
        headLength: 0.42,
        headSegments: 6,
      },
      humanoid: {
        bodyCapSegments: 8,
        bodyRadialSegments: 12,
        bodyRoughness: 0.9,
      },
      roadBrigand: {
        swordPosition: [0.5, 0, 0],
        swordSize: [0.08, 1.05, 0.12],
        swordColor: '#6a6b68',
        swordMetalness: 0.45,
        shieldPosition: [-0.5, 0.1, 0],
        shieldRadius: 0.34,
        shieldDepth: 0.1,
        shieldSegments: 10,
        shieldColor: '#5d5a50',
        shieldMetalness: 0.35,
      },
      brigandArcher: {
        bowPosition: [0.46, 0.1, 0],
        bowRadius: 0.38,
        bowTubeRadius: 0.035,
        bowRadialSegments: 6,
        bowTubularSegments: 16,
        bowColor: '#7a6044',
        bowRoughness: 0.9,
        drawBarPositionY: 0.88,
        drawBarWidth: 0.7,
        drawBarHeight: 0.06,
        drawBarDepth: 0.06,
        drawBarColor: '#d2b984',
        drawBarMinimumScale: 0.02,
      },
      healthBar: {
        verticalOffset: 0.8,
        backgroundDepth: 0.01,
        backgroundWidth: 0.9,
        backgroundHeight: 0.1,
        backgroundColor: '#28251f',
        fillDepth: 0.02,
        fillWidth: 0.84,
        fillHeight: 0.065,
        fillColor: '#9f493e',
      },
    })
  })
})
