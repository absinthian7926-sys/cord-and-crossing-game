import { describe, expect, it } from 'vitest'
import { PLAYER } from '../data/player'
import {
  applyDamage,
  canRun,
  initialVitals,
  spendDodgeStamina,
  spendStamina,
  updateVitals,
} from '../game/player/vitals'

describe('player vitals', () => {
  it('drains run stamina at eight points per second', () => {
    const vitals = initialVitals()
    updateVitals(vitals, 2, true)
    expect(vitals.stamina).toBe(84)
  })

  it('waits one second before regenerating stamina', () => {
    const vitals = {
      ...initialVitals(),
      stamina: 50,
      secondsSinceStaminaUse: 0,
    }
    updateVitals(vitals, 0.75, false)
    expect(vitals.stamina).toBe(50)
    updateVitals(vitals, 0.25, false)
    expect(vitals.stamina).toBe(55)
  })

  it('regenerates stamina without exceeding max', () => {
    const vitals = {
      ...initialVitals(),
      stamina: 95,
      secondsSinceStaminaUse: 1,
    }
    updateVitals(vitals, 1, false)
    expect(vitals.stamina).toBe(PLAYER.stamina.max)
  })

  it('requires 10 stamina before run re-engages after depletion', () => {
    const vitals = { ...initialVitals(), stamina: 4 }
    updateVitals(vitals, 1, true)
    expect(vitals.stamina).toBe(0)
    expect(canRun(vitals)).toBe(false)

    vitals.secondsSinceStaminaUse = 1
    updateVitals(vitals, 0.49, false)
    expect(vitals.stamina).toBeCloseTo(9.8)
    expect(canRun(vitals)).toBe(false)

    updateVitals(vitals, 0.01, false)
    expect(vitals.stamina).toBe(10)
    expect(canRun(vitals)).toBe(true)
  })

  it('spends 25 stamina on dodge and rejects an unaffordable dodge', () => {
    const affordable = initialVitals()
    expect(spendDodgeStamina(affordable)).toBe(true)
    expect(affordable.stamina).toBe(75)
    expect(spendDodgeStamina({ ...initialVitals(), stamina: 24 })).toBe(false)
  })

  it('spends a generic stamina cost without going below zero', () => {
    const vitals = { ...initialVitals(), stamina: 15 }
    expect(spendStamina(vitals, 15)).toBe(true)
    expect(vitals.stamina).toBe(0)
    expect(spendStamina(vitals, 1)).toBe(false)
    expect(spendStamina(vitals, -5)).toBe(true)
    expect(vitals.stamina).toBe(0)
  })

  it('waits four seconds after damage, then regenerates health', () => {
    const vitals = initialVitals()
    applyDamage(vitals, 40)
    updateVitals(vitals, 3.9, false)
    expect(vitals.health).toBe(60)
    updateVitals(vitals, 0.1, false)
    expect(vitals.health).toBeCloseTo(60.4)
  })

  it('regenerates 20 health per second immediately in the safe zone', () => {
    const vitals = initialVitals()
    applyDamage(vitals, 40)
    updateVitals(vitals, 1, false, true)
    expect(vitals.health).toBe(80)
    updateVitals(vitals, 2, false, true)
    expect(vitals.health).toBe(PLAYER.health.max)
  })
})
