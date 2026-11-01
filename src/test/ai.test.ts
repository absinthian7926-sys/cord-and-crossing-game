import { describe, expect, it } from 'vitest'
import { ENEMY_AI, ENEMY_TYPES } from '../data/enemies'
import {
  createAiStepResult,
  houndBiteCutsCordSegment,
  shouldBucklerBlock,
  stepAi,
  type AiInputs,
  type AiState,
} from '../game/enemies/ai'
import { initialCordState, step } from '../game/weapons/cordState'

const inputs = (overrides: Partial<AiInputs> = {}): AiInputs => ({
  enemyType: 'roadBrigand',
  distanceToPlayer: 30,
  distanceFromAnchor: 0,
  distanceToAnchor: 0,
  healthFraction: 1,
  lineOfSight: true,
  playerAlive: true,
  playerInSafeZone: false,
  stateElapsedSeconds: 0,
  attackCooldownSeconds: 0,
  attackWindupSeconds: 0,
  ...overrides,
})

const run = (state: AiState, overrides: Partial<AiInputs>, dt = 0) =>
  stepAi(state, inputs(overrides), dt, createAiStepResult())

describe('enemy AI', () => {
  it('moves from Idle to Patrol without an aggro target', () => {
    const result = run('Idle', {})
    expect(result.state).toBe('Patrol')
    expect(result.moveTarget).toBe('PatrolPoint')
  })

  it('moves from Patrol to Alert at the 18 m aggro boundary', () => {
    expect(
      run('Patrol', { distanceToPlayer: ENEMY_AI.aggroRadius }).state,
    ).toBe('Alert')
    expect(
      run('Patrol', { distanceToPlayer: ENEMY_AI.aggroRadius + 0.001 }).state,
    ).toBe('Patrol')
  })

  it('waits through the 0.6 s alert before Chase', () => {
    const waiting = run('Alert', { distanceToPlayer: 10 }, 0.59)
    expect(waiting.state).toBe('Alert')
    const chase = run(
      'Alert',
      { distanceToPlayer: 10, stateElapsedSeconds: 0.3 },
      0.3,
    )
    expect(chase.state).toBe('Chase')
    expect(chase.moveTarget).toBe('Player')
  })

  it('moves from Chase to Attack in range and back when out of range', () => {
    const attack = run('Chase', {
      distanceToPlayer: ENEMY_TYPES.roadBrigand.attackRange,
    })
    expect(attack.state).toBe('Attack')
    const chase = run('Attack', {
      distanceToPlayer: ENEMY_TYPES.roadBrigand.attackRange + 0.01,
    })
    expect(chase.state).toBe('Chase')
  })

  it('returns beyond the 40 m leash and idles at its anchor', () => {
    expect(
      run('Chase', { distanceToPlayer: 10, distanceFromAnchor: 40 }).state,
    ).toBe('Chase')
    expect(
      run('Chase', {
        distanceToPlayer: 10,
        distanceFromAnchor: 40.001,
      }).state,
    ).toBe('Return')
    const idle = run('Return', {
      distanceToPlayer: 30,
      distanceToAnchor: ENEMY_AI.returnAnchorDistance,
    })
    expect(idle.state).toBe('Idle')
    expect(idle.healAtAnchor).toBe(true)
  })

  it('makes only archers at or below 15 percent health flee', () => {
    expect(
      run('Chase', {
        enemyType: 'brigandArcher',
        healthFraction: 0.15,
        distanceToPlayer: 20,
      }).state,
    ).toBe('Flee')
    expect(
      run('Chase', {
        enemyType: 'brigandArcher',
        healthFraction: 0.150_001,
        distanceToPlayer: 20,
      }).state,
    ).not.toBe('Flee')
    expect(
      run('Chase', {
        enemyType: 'roadBrigand',
        healthFraction: 0.01,
        distanceToPlayer: 1,
      }).state,
    ).not.toBe('Flee')
  })

  it('makes an archer retreat inside 12 m', () => {
    const result = run('Chase', {
      enemyType: 'brigandArcher',
      distanceToPlayer:
        ENEMY_TYPES.brigandArcher.keepAway.minimumDistance - 0.01,
    })
    expect(result.state).toBe('Chase')
    expect(result.retreat).toBe(true)
    expect(result.moveTarget).toBe('AwayFromPlayer')
  })

  it('makes an archer approach above 25 m before attacking', () => {
    const approach = run('Chase', {
      enemyType: 'brigandArcher',
      distanceToPlayer:
        ENEMY_TYPES.brigandArcher.keepAway.maximumDistance + 0.01,
    })
    expect(approach.state).toBe('Chase')
    expect(approach.moveTarget).toBe('Player')
    expect(
      run('Chase', {
        enemyType: 'brigandArcher',
        distanceToPlayer: ENEMY_TYPES.brigandArcher.keepAway.maximumDistance,
      }).state,
    ).toBe('Attack')
  })

  it('returns instead of aggroing inside the safe zone', () => {
    const result = run('Patrol', {
      distanceToPlayer: 5,
      playerInSafeZone: true,
    })
    expect(result.state).toBe('Return')
    expect(result.attack).toBe(false)
    expect(result.healAtAnchor).toBe(true)
  })

  it('forces Return when the player is dead', () => {
    expect(
      run('Attack', {
        distanceToPlayer: 1,
        playerAlive: false,
      }).state,
    ).toBe('Return')
  })

  it('holds the visible archer draw for 0.6 s before release', () => {
    const drawing = run(
      'Attack',
      {
        enemyType: 'brigandArcher',
        distanceToPlayer: 20,
      },
      0.3,
    )
    expect(drawing.attack).toBe(false)
    const released = run(
      'Attack',
      {
        enemyType: 'brigandArcher',
        distanceToPlayer: 20,
        attackWindupSeconds: drawing.attackWindupSeconds,
      },
      0.3,
    )
    expect(released.attack).toBe(true)
    expect(released.attackCooldownSeconds).toBe(
      ENEMY_TYPES.brigandArcher.attackCadenceSeconds,
    )

    const cadenceDrawing = run(
      'Attack',
      {
        enemyType: 'brigandArcher',
        distanceToPlayer: 20,
        attackCooldownSeconds: released.attackCooldownSeconds,
      },
      ENEMY_TYPES.brigandArcher.attackCadenceSeconds -
        ENEMY_TYPES.brigandArcher.drawSeconds / 2,
    )
    expect(cadenceDrawing.attack).toBe(false)
    expect(cadenceDrawing.attackWindupSeconds).toBeCloseTo(
      ENEMY_TYPES.brigandArcher.drawSeconds / 2,
    )
    const cadenceRelease = run(
      'Attack',
      {
        enemyType: 'brigandArcher',
        distanceToPlayer: 20,
        attackCooldownSeconds: cadenceDrawing.attackCooldownSeconds,
      },
      ENEMY_TYPES.brigandArcher.drawSeconds / 2,
    )
    expect(cadenceRelease.attack).toBe(true)
  })

  it('bites on the hound 0.8 s attack cadence', () => {
    const firstBite = run('Attack', {
      enemyType: 'cliffHound',
      distanceToPlayer: ENEMY_TYPES.cliffHound.attackRange,
    })
    expect(firstBite.attack).toBe(true)
    expect(firstBite.attackCooldownSeconds).toBe(
      ENEMY_TYPES.cliffHound.attackCadenceSeconds,
    )

    const waiting = run(
      'Attack',
      {
        enemyType: 'cliffHound',
        distanceToPlayer: ENEMY_TYPES.cliffHound.attackRange,
        attackCooldownSeconds: firstBite.attackCooldownSeconds,
      },
      ENEMY_TYPES.cliffHound.attackCadenceSeconds - 0.01,
    )
    expect(waiting.attack).toBe(false)

    const nextBite = run(
      'Attack',
      {
        enemyType: 'cliffHound',
        distanceToPlayer: ENEMY_TYPES.cliffHound.attackRange,
        attackCooldownSeconds: waiting.attackCooldownSeconds,
      },
      0.01,
    )
    expect(nextBite.attack).toBe(true)
    expect(nextBite.attackCooldownSeconds).toBe(
      ENEMY_TYPES.cliffHound.attackCadenceSeconds,
    )
  })

  it('blocks about half of frontal straight casts with seeded rolls', () => {
    let seed = 0x1234_5678
    let blocked = 0
    const trials = 10_000
    for (let index = 0; index < trials; index += 1) {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
      if (
        shouldBucklerBlock(
          'roadBrigand',
          'straightCast',
          0,
          false,
          seed / 0x1_0000_0000,
        )
      ) {
        blocked += 1
      }
    }
    expect(blocked / trials).toBeCloseTo(0.5, 1)
    expect(shouldBucklerBlock('roadBrigand', 'flatArc', 0, false, 0)).toBe(
      false,
    )
    expect(shouldBucklerBlock('roadBrigand', 'straightCast', 0, true, 0)).toBe(
      false,
    )
    expect(
      shouldBucklerBlock('roadBrigand', 'straightCast', 46, false, 0),
    ).toBe(false)
  })

  it('uses the existing cord geometry path for hound cuts', () => {
    const out = step(initialCordState(), { type: 'castRelease' })
    expect(houndBiteCutsCordSegment(out, 0, 0, 1, 0, 0, 0, 0, 0, 2)).toBe(true)
    expect(houndBiteCutsCordSegment(out, 2, 0, 1, 0, 0, 0, 0, 0, 2)).toBe(false)
    const returning = step(out, { type: 'recallPressed' })
    expect(houndBiteCutsCordSegment(returning, 0, 0, 1, 0, 0, 0, 0, 0, 2)).toBe(
      false,
    )
  })
})
