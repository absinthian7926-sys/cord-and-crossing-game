import { describe, expect, it } from 'vitest'
import { REACHBLADE } from '../data/weapons'
import {
  applyCombatDamage,
  incomingDamage,
  initialComboState,
  isTargetInArc,
  recallDuration,
  selectFlatArcTargets,
  shoveDamage,
  tryStartCloseAttack,
} from '../game/combat/combat'
import { capsuleOverlapsPoint } from '../game/combat/hitboxes'
import { isDoubleTap } from '../game/player/input'
import { initialVitals } from '../game/player/vitals'

describe('reachblade combat', () => {
  it('uses the exact three-hit combo data', () => {
    let combo = initialComboState()
    for (let index = 0; index < 3; index += 1) {
      const result = tryStartCloseAttack(combo, index * 0.2, 100)
      expect(result.attack).toMatchObject({
        index,
        damage: REACHBLADE.close.damage[index],
        windupSeconds: REACHBLADE.close.windupSeconds[index],
        activeSeconds: 0.08,
        staminaCost: REACHBLADE.close.staminaCost[index],
      })
      combo = result.combo
    }
  })

  it('resets the combo after the 0.5 second window', () => {
    const first = tryStartCloseAttack(initialComboState(), 1, 100)
    const reset = tryStartCloseAttack(first.combo, 1.681, 100)
    expect(reset.attack?.index).toBe(0)
    const boundary = tryStartCloseAttack(first.combo, 1.68, 100)
    expect(boundary.attack?.index).toBe(1)
  })

  it('blocks hit three below 10 stamina and resets', () => {
    const afterFirst = tryStartCloseAttack(initialComboState(), 0, 100)
    const afterSecond = tryStartCloseAttack(afterFirst.combo, 0.2, 100)
    const blocked = tryStartCloseAttack(afterSecond.combo, 0.4, 9.99)
    expect(blocked.attack).toBeNull()
    expect(blocked.combo).toEqual(initialComboState())
  })

  it('checks close reach and angle', () => {
    expect(isTargetInArc(0, 0, 0, -1, 0, -1.6, 1.6, 100)).toBe(true)
    expect(isTargetInArc(0, 0, 0, -1, 1.6, 0, 1.6, 100)).toBe(false)
    expect(isTargetInArc(0, 0, 0, -1, 0, -1.61, 1.6, 100)).toBe(false)
    expect(isTargetInArc(0, 0, 0, 0, 0, -1, 1.6, 100)).toBe(false)
    expect(isTargetInArc(0, 0, 0, -1, 0, 0, 1.6, 100)).toBe(true)
  })

  it('selects at most three targets in the 140 degree flat arc', () => {
    const targets = [
      { id: 'a', x: 0, z: -4 },
      { id: 'b', x: 1, z: -4 },
      { id: 'c', x: -1, z: -4 },
      { id: 'd', x: 0, z: -5 },
      { id: 'near', x: 0, z: -3 },
      { id: 'behind', x: 0, z: 4 },
    ]
    expect(
      selectFlatArcTargets(targets, 0, 0, 0, -1).map(({ id }) => id),
    ).toEqual(['a', 'b', 'c'])
  })

  it('applies unarmed damage, dodge invulnerability and shove damage', () => {
    expect(incomingDamage(12, false, false)).toBe(12)
    expect(incomingDamage(12, true, false)).toBe(15)
    expect(incomingDamage(12, true, true)).toBe(0)
    expect(incomingDamage(-2, true, false)).toBe(0)
    expect(shoveDamage()).toBe(5)
    const vitals = initialVitals()
    expect(applyCombatDamage(vitals, 12, true, false)).toBe(15)
    expect(vitals.health).toBe(85)
    expect(applyCombatDamage(vitals, 12, true, true)).toBe(0)
    expect(vitals.health).toBe(85)
  })

  it('scales recall linearly from current distance', () => {
    expect(recallDuration(0)).toBe(0)
    expect(recallDuration(3.25)).toBeCloseTo(0.275)
    expect(recallDuration(6.5)).toBe(0.55)
    expect(recallDuration(20)).toBe(0.55)
  })

  it('detects the 0.3 second Q double-tap boundary', () => {
    expect(isDoubleTap(Number.NEGATIVE_INFINITY, 1, 0.3)).toBe(false)
    expect(isDoubleTap(1, 1.3, 0.3)).toBe(true)
    expect(isDoubleTap(1, 1.300_001, 0.3)).toBe(false)
    expect(isDoubleTap(2, 1, 0.3)).toBe(false)
  })

  it('detects cord cutter overlap against a rope capsule', () => {
    expect(capsuleOverlapsPoint(0, 0, 1, 0, 0, 0, 0, 0, 2, 0.2)).toBe(true)
    expect(capsuleOverlapsPoint(1, 0, 1, 0, 0, 0, 0, 0, 2, 0.2)).toBe(false)
    expect(capsuleOverlapsPoint(0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2)).toBe(true)
  })
})
