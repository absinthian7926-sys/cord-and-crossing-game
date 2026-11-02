import { describe, expect, it } from 'vitest'
import { PLAYER_DEATH } from '../data/enemies'
import { PLAYER } from '../data/player'
import {
  beginPlayerDeath,
  createPlayerDeathState,
  isPlayerInputLocked,
  isPlayerSpawnInvulnerable,
  resetVitalsForRespawn,
  stepPlayerDeath,
  WAYSTATION_RESPAWN,
} from '../game/player/death'
import { initialVitals } from '../game/player/vitals'
import { applyQuestEvent, createQuestState } from '../game/quest/quest'

describe('player death and respawn', () => {
  it('starts death at zero health and locks input during the fade', () => {
    const state = createPlayerDeathState()
    expect(beginPlayerDeath(state, 1)).toBe(false)
    expect(beginPlayerDeath(state, 0)).toBe(true)
    expect(isPlayerInputLocked(state)).toBe(true)
    expect(state.fadeRemainingSeconds).toBe(PLAYER_DEATH.fadeSeconds)
    expect(beginPlayerDeath(state, 0)).toBe(false)
  })

  it('respawns after 1.5 s at the waystation with full vitals and blade In Hand', () => {
    const state = createPlayerDeathState()
    const vitals = initialVitals()
    vitals.health = 0
    vitals.stamina = 0
    vitals.runLocked = true
    beginPlayerDeath(state, vitals.health)
    expect(stepPlayerDeath(state, 1.49)).toBe(false)
    expect(stepPlayerDeath(state, 0.01)).toBe(true)
    resetVitalsForRespawn(vitals)
    expect(vitals.health).toBe(PLAYER.health.max)
    expect(vitals.stamina).toBe(PLAYER.stamina.max)
    expect(vitals.runLocked).toBe(false)
    expect(WAYSTATION_RESPAWN).toEqual({
      x: 0,
      y: 8,
      z: 0,
      cordMode: 'InHand',
    })
    expect(isPlayerInputLocked(state)).toBe(false)
    expect(isPlayerSpawnInvulnerable(state)).toBe(true)
  })

  it('keeps spawn invulnerability for exactly two seconds', () => {
    const state = createPlayerDeathState()
    beginPlayerDeath(state, 0)
    stepPlayerDeath(state, PLAYER_DEATH.fadeSeconds)
    expect(isPlayerSpawnInvulnerable(state)).toBe(true)
    expect(Number.isFinite(state.spawnInvulnerabilityRemainingSeconds)).toBe(
      true,
    )
    expect(state.spawnInvulnerabilityRemainingSeconds).toBe(
      PLAYER_DEATH.spawnInvulnerabilitySeconds,
    )
    stepPlayerDeath(state, PLAYER_DEATH.spawnInvulnerabilitySeconds - 0.01)
    expect(isPlayerSpawnInvulnerable(state)).toBe(true)
    stepPlayerDeath(state, 0.01)
    expect(isPlayerSpawnInvulnerable(state)).toBe(false)
  })

  it('does not change quest progress when the player dies and respawns', () => {
    const deathState = createPlayerDeathState()
    const questBeforeDeath = applyQuestEvent(
      createQuestState(),
      'talkedToHollen',
    )
    const questSnapshot = structuredClone(questBeforeDeath)

    beginPlayerDeath(deathState, 0)
    stepPlayerDeath(deathState, PLAYER_DEATH.fadeSeconds)

    expect(questBeforeDeath).toEqual(questSnapshot)
  })
})
