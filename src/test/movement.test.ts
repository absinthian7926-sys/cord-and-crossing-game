import { describe, expect, it } from 'vitest'
import { PLAYER } from '../data/player'
import { resolveGroundSpeed } from '../game/player/movement'
import { initialVitals, updateVitals } from '../game/player/vitals'

describe('ground movement speed', () => {
  it('uses the GDD walk and run speeds for the Shift input', () => {
    const vitals = initialVitals()
    expect(resolveGroundSpeed(false, true, vitals)).toBe(
      PLAYER.movement.walkSpeed,
    )
    expect(resolveGroundSpeed(true, true, vitals)).toBe(
      PLAYER.movement.runSpeed,
    )
    expect(resolveGroundSpeed(true, false, vitals)).toBe(
      PLAYER.movement.walkSpeed,
    )
  })

  it('uses hysteresis at the stamina re-engage threshold without flicker', () => {
    const vitals = {
      ...initialVitals(),
      stamina: PLAYER.stamina.runReengageThreshold - 0.01,
      runLocked: true,
    }
    updateVitals(vitals, 0, false)
    expect(resolveGroundSpeed(true, true, vitals)).toBe(
      PLAYER.movement.walkSpeed,
    )

    vitals.stamina = PLAYER.stamina.runReengageThreshold
    updateVitals(vitals, 0, false)
    expect(resolveGroundSpeed(true, true, vitals)).toBe(
      PLAYER.movement.runSpeed,
    )

    vitals.stamina = PLAYER.stamina.runReengageThreshold - 0.01
    expect(resolveGroundSpeed(true, true, vitals)).toBe(
      PLAYER.movement.runSpeed,
    )
  })
})
