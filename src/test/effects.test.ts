import { describe, expect, it } from 'vitest'
import { EFFECTS } from '../data/effects'
import {
  addEffect,
  addEffectFromCrossing,
  carryEffectOnLine,
  clearEffects,
  createEffectSystem,
  getEffectRemainingSeconds,
  hasEffect,
  isLineCarrying,
  makeLinePlain,
  queryEffectMultipliers,
  removeEffect,
  tickEffects,
  type EffectDefinition,
  type EffectMultipliers,
} from '../game/effects/effects'

const effect = (
  id: string,
  overrides: Partial<EffectDefinition> = {},
): EffectDefinition => ({
  id,
  durationSeconds: 10,
  closeDamageMultiplier: 1,
  castPullForceMultiplier: 1,
  staggerDurationMultiplier: 1,
  carriedCastDamageMultiplier: 1,
  carriedCastBreaksGuard: false,
  ...overrides,
})

const multipliers = (): EffectMultipliers => ({
  closeDamage: -1,
  castPullForce: -1,
  staggerDuration: -1,
  carriedCastDamage: -1,
  carriedCastBreaksGuard: true,
})

describe('effect system', () => {
  it('adds, queries and expires Strength at exactly its configured duration', () => {
    const state = createEffectSystem()
    expect(addEffect(state, EFFECTS.strength)).toBe(true)
    expect(state.activeCount).toBe(1)
    expect(hasEffect(state, EFFECTS.strength.id)).toBe(true)
    expect(getEffectRemainingSeconds(state, EFFECTS.strength.id)).toBe(
      EFFECTS.strength.durationSeconds,
    )

    expect(tickEffects(state, EFFECTS.strength.durationSeconds - 1)).toBe(0)
    expect(getEffectRemainingSeconds(state, EFFECTS.strength.id)).toBe(1)
    expect(tickEffects(state, 1)).toBe(1)
    expect(hasEffect(state, EFFECTS.strength.id)).toBe(false)
    expect(getEffectRemainingSeconds(state, EFFECTS.strength.id)).toBe(0)
  })

  it('refreshes an existing effect without stacking it', () => {
    const state = createEffectSystem()
    addEffect(state, EFFECTS.strength)
    tickEffects(state, 12)
    expect(addEffect(state, EFFECTS.strength)).toBe(true)
    expect(state.activeCount).toBe(1)
    expect(getEffectRemainingSeconds(state, EFFECTS.strength.id)).toBe(
      EFFECTS.strength.durationSeconds,
    )
  })

  it('enforces the two-effect cap and rejects a third distinct effect', () => {
    const state = createEffectSystem()
    expect(addEffect(state, effect('one'))).toBe(true)
    expect(addEffect(state, effect('two'))).toBe(true)
    expect(addEffect(state, effect('three'))).toBe(false)
    expect(state.activeCount).toBe(EFFECTS.maximumActive)
  })

  it('fails safely if externally corrupted capacity has no empty slot', () => {
    const state = createEffectSystem()
    state.slots[0].definition = effect('occupied')
    state.slots[1].definition = effect('also-occupied')
    state.activeCount = 0
    expect(addEffect(state, effect('new'))).toBe(false)
  })

  it('uses injected crossing config for duration and return grants', () => {
    const state = createEffectSystem()
    const configured = {
      ...EFFECTS.strength,
      durationSeconds: 4,
      returnCrossingGrantsEffect: true,
    } as const

    expect(addEffectFromCrossing(state, configured, true)).toBe(true)
    expect(getEffectRemainingSeconds(state, configured.id)).toBe(4)
    tickEffects(state, 4)
    expect(hasEffect(state, configured.id)).toBe(false)

    const defaultState = createEffectSystem()
    expect(addEffectFromCrossing(defaultState, EFFECTS.strength, true)).toBe(
      false,
    )
    expect(addEffectFromCrossing(defaultState, EFFECTS.strength, false)).toBe(
      true,
    )
  })

  it('applies active and carried multipliers only while applicable', () => {
    const state = createEffectSystem()
    const output = multipliers()
    expect(queryEffectMultipliers(state, output)).toBe(output)
    expect(output).toEqual({
      closeDamage: 1,
      castPullForce: 1,
      staggerDuration: 1,
      carriedCastDamage: 1,
      carriedCastBreaksGuard: false,
    })

    addEffect(state, EFFECTS.strength)
    queryEffectMultipliers(state, output)
    expect(output).toEqual({
      closeDamage: EFFECTS.strength.closeDamageMultiplier,
      castPullForce: EFFECTS.strength.castPullForceMultiplier,
      staggerDuration: EFFECTS.strength.staggerDurationMultiplier,
      carriedCastDamage: 1,
      carriedCastBreaksGuard: false,
    })

    expect(carryEffectOnLine(state, EFFECTS.strength.id)).toBe(true)
    queryEffectMultipliers(state, output)
    expect(output.carriedCastDamage).toBe(
      EFFECTS.strength.carriedCastDamageMultiplier,
    )
    expect(output.carriedCastBreaksGuard).toBe(true)
  })

  it('combines distinct active effects without allocating query output', () => {
    const state = createEffectSystem()
    addEffect(
      state,
      effect('one', {
        closeDamageMultiplier: 2,
        castPullForceMultiplier: 3,
        staggerDurationMultiplier: 4,
        carriedCastDamageMultiplier: 5,
      }),
    )
    addEffect(
      state,
      effect('two', {
        closeDamageMultiplier: 1.5,
        castPullForceMultiplier: 2,
        staggerDurationMultiplier: 1.25,
      }),
    )
    carryEffectOnLine(state, 'one')
    const output = multipliers()
    expect(queryEffectMultipliers(state, output)).toBe(output)
    expect(output).toEqual({
      closeDamage: 3,
      castPullForce: 6,
      staggerDuration: 5,
      carriedCastDamage: 5,
      carriedCastBreaksGuard: false,
    })
  })

  it('clears a carried line on effect expiry and removal', () => {
    const state = createEffectSystem()
    addEffect(state, effect('short', { durationSeconds: 1 }))
    carryEffectOnLine(state, 'short')
    expect(isLineCarrying(state)).toBe(true)
    expect(tickEffects(state, 1)).toBe(1)
    expect(state.carriedEffectId).toBeNull()
    expect(isLineCarrying(state)).toBe(false)

    addEffect(state, effect('removed'))
    carryEffectOnLine(state, 'removed')
    expect(removeEffect(state, 'removed')).toBe(true)
    expect(state.carriedEffectId).toBeNull()
    expect(removeEffect(state, 'missing')).toBe(false)
  })

  it.each(['cut', 'stop', 'death'] as const)(
    'makes the line plain on %s',
    (reason) => {
      const state = createEffectSystem()
      addEffect(state, EFFECTS.strength)
      expect(carryEffectOnLine(state, EFFECTS.strength.id)).toBe(true)
      expect(makeLinePlain(state, reason)).toBe(true)
      expect(makeLinePlain(state, reason)).toBe(false)
      expect(hasEffect(state, EFFECTS.strength.id)).toBe(true)
    },
  )

  it('rejects carrying an absent effect and clears all active state', () => {
    const state = createEffectSystem()
    expect(carryEffectOnLine(state, 'missing')).toBe(false)
    addEffect(state, effect('one'))
    addEffect(state, effect('two'))
    carryEffectOnLine(state, 'one')
    clearEffects(state)
    expect(state.activeCount).toBe(0)
    expect(state.carriedEffectId).toBeNull()
    expect(state.slots.every((slot) => slot.definition === null)).toBe(true)
  })

  it('clamps negative durations and negative tick time', () => {
    const state = createEffectSystem()
    addEffect(state, effect('zero', { durationSeconds: -2 }))
    expect(getEffectRemainingSeconds(state, 'zero')).toBe(0)
    expect(tickEffects(state, -1)).toBe(1)
  })
})
