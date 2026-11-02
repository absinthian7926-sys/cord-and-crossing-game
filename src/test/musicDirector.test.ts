import { describe, expect, it } from 'vitest'
import { AUDIO } from '../data/audio'
import {
  createMusicDirectorState,
  stepMusicDirector,
} from '../game/audio/musicDirector'

describe('music director', () => {
  it('uses the seeded Slice 1 music definition', () => {
    expect(AUDIO.music).toMatchObject({
      seed: 7,
      tempoBpm: 72,
      scale: 'D dorian',
      phraseNoteMinimum: 2,
      phraseNoteMaximum: 4,
      restBeatMinimum: 4,
      restBeatMaximum: 12,
      combatEnterSeconds: 2,
      combatLeaveSeconds: 6,
      crossfadeSeconds: 2,
    })
  })

  it('enters combat at 2 seconds but not 1.9 seconds', () => {
    const state = createMusicDirectorState()
    expect(stepMusicDirector(state, true, false, 1.9)).toBe(state)
    expect(state.layer).toBe('explore')
    stepMusicDirector(state, true, false, 0.1)
    expect(state.layer).toBe('combat')
    expect(state.combatSeconds).toBe(0)
  })

  it('leaves combat after 6 clear seconds', () => {
    const state = createMusicDirectorState()
    stepMusicDirector(state, true, false, 2)
    stepMusicDirector(state, false, false, 5.9)
    expect(state.layer).toBe('combat')
    stepMusicDirector(state, false, false, 0.1)
    expect(state.layer).toBe('explore')
    expect(state.clearSeconds).toBe(0)
  })

  it('resets the relevant timer when combat presence changes', () => {
    const state = createMusicDirectorState()
    stepMusicDirector(state, true, false, 1)
    stepMusicDirector(state, false, false, 1)
    expect(state.combatSeconds).toBe(0)
    stepMusicDirector(state, true, false, 2)
    stepMusicDirector(state, false, false, 5)
    stepMusicDirector(state, true, false, 0.1)
    expect(state.layer).toBe('combat')
    expect(state.clearSeconds).toBe(0)
  })

  it('does not count paused or invalid time', () => {
    const state = createMusicDirectorState()
    stepMusicDirector(state, true, true, 10)
    stepMusicDirector(state, true, false, -1)
    stepMusicDirector(state, true, false, Number.NaN)
    expect(state.layer).toBe('explore')
    expect(state.combatSeconds).toBe(0)
  })
})
