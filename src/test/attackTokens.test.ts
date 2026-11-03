import { describe, expect, it } from 'vitest'
import {
  acquireAttackToken,
  applyAttackTokenEvent,
  clearAttackTokens,
  countAttackTokens,
  createAttackTokenState,
  ownsAttackToken,
  releaseAttackToken,
  resolveWaitingTarget,
  tokenKindForEnemy,
} from '../game/enemies/attackTokens'

describe('enemy attack tokens', () => {
  it('never grants more than two melee attack tokens', () => {
    const state = createAttackTokenState()

    expect(acquireAttackToken(state, 'brigand-1', 'melee', false)).toBe(true)
    expect(acquireAttackToken(state, 'hound-1', 'melee', false)).toBe(true)
    expect(acquireAttackToken(state, 'leader', 'melee', false)).toBe(false)
    expect(countAttackTokens(state, 'melee')).toBe(2)
    expect(ownsAttackToken(state, 'brigand-1', 'melee')).toBe(true)
    expect(ownsAttackToken(state, 'leader', 'melee')).toBe(false)
  })

  it.each(['impact', 'stagger', 'death'] as const)(
    'frees a melee token after %s',
    (event) => {
      const state = createAttackTokenState()
      acquireAttackToken(state, 'brigand-1', 'melee', false)
      acquireAttackToken(state, 'brigand-2', 'melee', false)

      expect(
        applyAttackTokenEvent(state, 'brigand-1', 'melee', event, false),
      ).toBe(true)
      expect(acquireAttackToken(state, 'hound-1', 'melee', false)).toBe(true)
      expect(countAttackTokens(state, 'melee')).toBe(2)
    },
  )

  it('holds waiting enemies at 3.5 m while circling deterministically', () => {
    const target = { x: 0, z: 0 }

    resolveWaitingTarget(target, 'brigand-even', 2, 0, 0, 0)
    expect(Math.hypot(target.x, target.z)).toBeCloseTo(3.5, 6)
    expect(target.z).not.toBe(0)

    const repeated = { x: 0, z: 0 }
    resolveWaitingTarget(repeated, 'brigand-even', 2, 0, 0, 0)
    expect(repeated).toEqual(target)

    const coincident = { x: 0, z: 0 }
    resolveWaitingTarget(coincident, 'odd', 0, 0, 0, 0)
    expect(Math.hypot(coincident.x, coincident.z)).toBeCloseTo(3.5, 6)
  })

  it('limits archers independently to two draw tokens', () => {
    const state = createAttackTokenState()

    expect(tokenKindForEnemy('brigandArcher')).toBe('ranged')
    expect(tokenKindForEnemy('roadBrigand')).toBe('melee')
    expect(tokenKindForEnemy('cliffHound')).toBe('melee')
    expect(acquireAttackToken(state, 'archer-1', 'ranged', false)).toBe(true)
    expect(acquireAttackToken(state, 'archer-2', 'ranged', false)).toBe(true)
    expect(acquireAttackToken(state, 'archer-3', 'ranged', false)).toBe(false)
    expect(acquireAttackToken(state, 'brigand-1', 'melee', false)).toBe(true)
    expect(countAttackTokens(state, 'ranged')).toBe(2)
    expect(countAttackTokens(state, 'melee')).toBe(1)
  })

  it('does not change token ownership while paused', () => {
    const state = createAttackTokenState()
    acquireAttackToken(state, 'brigand-1', 'melee', false)

    expect(acquireAttackToken(state, 'brigand-2', 'melee', true)).toBe(false)
    expect(releaseAttackToken(state, 'brigand-1', true)).toBe(false)
    expect(ownsAttackToken(state, 'brigand-1', 'melee')).toBe(true)
    expect(countAttackTokens(state, 'melee')).toBe(1)
  })

  it('treats repeat acquisition as ownership and clears both pools', () => {
    const state = createAttackTokenState()
    expect(acquireAttackToken(state, 'brigand-1', 'melee', false)).toBe(true)
    expect(
      applyAttackTokenEvent(state, 'brigand-1', 'melee', 'request', false),
    ).toBe(true)
    expect(releaseAttackToken(state, 'missing', false)).toBe(false)
    acquireAttackToken(state, 'archer-1', 'ranged', false)

    clearAttackTokens(state)

    expect(countAttackTokens(state, 'melee')).toBe(0)
    expect(countAttackTokens(state, 'ranged')).toBe(0)
  })

  it('releases a token when its owner leaves Attack', () => {
    const state = createAttackTokenState()
    acquireAttackToken(state, 'brigand-1', 'melee', false)

    expect(
      applyAttackTokenEvent(state, 'brigand-1', 'melee', 'leftAttack', false),
    ).toBe(true)
    expect(countAttackTokens(state, 'melee')).toBe(0)
  })
})
