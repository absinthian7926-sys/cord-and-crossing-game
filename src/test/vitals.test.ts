import { describe, expect, it } from 'vitest'
import { PLAYER } from '../data/player'
import {
  applyDamage,
  initialVitals,
  spendDodgeStamina,
  updateVitals,
} from '../game/player/vitals'
describe('player vitals', () => {
  it('drains run stamina at eight points per second', () =>
    expect(updateVitals(initialVitals(), 2, true).stamina).toBe(84))
  it('waits one second before regenerating stamina', () => {
    const spent = { ...initialVitals(), stamina: 50, secondsSinceStaminaUse: 0 }
    const waiting = updateVitals(spent, 0.75, false)
    expect(waiting.stamina).toBe(50)
    expect(updateVitals(waiting, 0.25, false).stamina).toBe(55)
  })
  it('regenerates stamina without exceeding max', () =>
    expect(
      updateVitals(
        { ...initialVitals(), stamina: 95, secondsSinceStaminaUse: 1 },
        1,
        false,
      ).stamina,
    ).toBe(PLAYER.stamina.max))
  it('spends 25 stamina on dodge and rejects an unaffordable dodge', () => {
    expect(spendDodgeStamina(initialVitals())?.stamina).toBe(75)
    expect(spendDodgeStamina({ ...initialVitals(), stamina: 24 })).toBeNull()
  })
  it('waits six seconds after damage, then regenerates health', () => {
    const waiting = updateVitals(applyDamage(initialVitals(), 40), 5.5, false)
    expect(waiting.health).toBe(60)
    expect(updateVitals(waiting, 0.5, false).health).toBe(62)
  })
})
