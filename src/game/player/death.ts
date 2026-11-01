import { PLAYER } from '../../data/player'
import { PLAYER_DEATH } from '../../data/enemies'
import type { CordMode } from '../weapons/cordState'
import type { Vitals } from './vitals'

export type PlayerDeathPhase = 'Alive' | 'Fading'

export type PlayerDeathState = {
  phase: PlayerDeathPhase
  fadeRemainingSeconds: number
  spawnInvulnerabilityRemainingSeconds: number
}

export type PlayerRespawnPoint = {
  x: number
  y: number
  z: number
  cordMode: CordMode
}

export const WAYSTATION_RESPAWN: PlayerRespawnPoint = {
  x: PLAYER_DEATH.spawn[0],
  y: PLAYER_DEATH.spawn[1],
  z: PLAYER_DEATH.spawn[2],
  cordMode: PLAYER_DEATH.respawnCordMode,
}

export function createPlayerDeathState(): PlayerDeathState {
  return {
    phase: 'Alive',
    fadeRemainingSeconds: 0,
    spawnInvulnerabilityRemainingSeconds: 0,
  }
}

export function beginPlayerDeath(
  state: PlayerDeathState,
  health: number,
): boolean {
  if (state.phase !== 'Alive' || health > 0) return false
  state.phase = 'Fading'
  state.fadeRemainingSeconds = PLAYER_DEATH.fadeSeconds
  state.spawnInvulnerabilityRemainingSeconds = 0
  return true
}

export function stepPlayerDeath(
  state: PlayerDeathState,
  dtSeconds: number,
): boolean {
  const deltaSeconds = Math.max(0, dtSeconds)
  if (state.phase === 'Fading') {
    const fadeRemainingSeconds = Math.max(
      0,
      state.fadeRemainingSeconds - deltaSeconds,
    )
    state.fadeRemainingSeconds =
      fadeRemainingSeconds <= Number.EPSILON ? 0 : fadeRemainingSeconds
    if (state.fadeRemainingSeconds === 0) {
      state.phase = 'Alive'
      state.spawnInvulnerabilityRemainingSeconds =
        PLAYER_DEATH.spawnInvulnerabilitySeconds
      return true
    }
    return false
  }
  const invulnerabilityRemainingSeconds = Math.max(
    0,
    state.spawnInvulnerabilityRemainingSeconds - deltaSeconds,
  )
  state.spawnInvulnerabilityRemainingSeconds =
    invulnerabilityRemainingSeconds <= Number.EPSILON
      ? 0
      : invulnerabilityRemainingSeconds
  return false
}

export function resetVitalsForRespawn(vitals: Vitals): void {
  vitals.health = PLAYER.health.max
  vitals.stamina = PLAYER.stamina.max
  vitals.secondsSinceDamage = Number.POSITIVE_INFINITY
  vitals.secondsSinceStaminaUse = Number.POSITIVE_INFINITY
  vitals.runLocked = false
}

export function isPlayerInputLocked(state: PlayerDeathState): boolean {
  return state.phase !== 'Alive'
}

export function isPlayerSpawnInvulnerable(state: PlayerDeathState): boolean {
  return state.spawnInvulnerabilityRemainingSeconds > 0
}
