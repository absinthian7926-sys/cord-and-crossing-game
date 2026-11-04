import { AUDIO } from '../../data/audio'

export type MusicLayer = 'explore' | 'combat'

export type MusicDirectorState = {
  layer: MusicLayer
  combatSeconds: number
  clearSeconds: number
}

export function createMusicDirectorState(): MusicDirectorState {
  return { layer: 'explore', combatSeconds: 0, clearSeconds: 0 }
}

export function stepMusicDirector(
  state: MusicDirectorState,
  enemyInCombat: boolean,
  paused: boolean,
  deltaSeconds: number,
): MusicDirectorState {
  if (paused || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0)
    return state

  if (state.layer === 'explore') {
    state.clearSeconds = 0
    if (!enemyInCombat) {
      state.combatSeconds = 0
      return state
    }
    state.combatSeconds += deltaSeconds
    if (state.combatSeconds >= AUDIO.music.combatEnterSeconds) {
      state.layer = 'combat'
      state.combatSeconds = 0
    }
    return state
  }

  state.combatSeconds = 0
  if (enemyInCombat) {
    state.clearSeconds = 0
    return state
  }
  state.clearSeconds += deltaSeconds
  if (state.clearSeconds >= AUDIO.music.combatLeaveSeconds) {
    state.layer = 'explore'
    state.clearSeconds = 0
  }
  return state
}
