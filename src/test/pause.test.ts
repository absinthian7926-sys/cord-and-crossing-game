import { describe, expect, it } from 'vitest'
import {
  createPauseState,
  gameplayDelta,
  reducePause,
  type PauseContext,
} from '../game/pause/pause'
import {
  advancePausableClock,
  getPauseRuntimeSnapshot,
  resetPauseRuntime,
  setPauseOpen,
  setTitleScreenOpen,
} from '../game/pause/pauseRuntime'

const clearContext = (): PauseContext => ({
  titleOpen: false,
  dialogueOpen: false,
  questLogOpen: false,
  crossingFlash: false,
  loading: false,
  deathFade: false,
})

describe('pause rules', () => {
  it('toggles with Escape and resumes explicitly', () => {
    const state = createPauseState()
    expect(reducePause(state, { type: 'escape' }, clearContext()).action).toBe(
      'opened',
    )
    expect(state.open).toBe(true)
    expect(reducePause(state, { type: 'escape' }, clearContext()).action).toBe(
      'closed',
    )
    expect(state.open).toBe(false)
    reducePause(state, { type: 'open' }, clearContext())
    expect(reducePause(state, { type: 'resume' }, clearContext()).action).toBe(
      'closed',
    )
    expect(state).toEqual({ open: false, pending: false })
  })

  it('closes dialogue or quest log before opening pause', () => {
    const state = createPauseState()
    const dialogue = clearContext()
    dialogue.dialogueOpen = true
    expect(reducePause(state, { type: 'escape' }, dialogue).action).toBe(
      'closeDialogue',
    )
    expect(state.open).toBe(false)

    const questLog = clearContext()
    questLog.questLogOpen = true
    expect(reducePause(state, { type: 'escape' }, questLog).action).toBe(
      'closeQuestLog',
    )
    expect(state.open).toBe(false)
  })

  it.each(['crossingFlash', 'loading', 'deathFade'] as const)(
    'defers Escape during %s and opens after the blocker clears',
    (key) => {
      const state = createPauseState()
      const blocked = clearContext()
      blocked[key] = true
      expect(reducePause(state, { type: 'escape' }, blocked).action).toBe(
        'deferred',
      )
      expect(state).toEqual({ open: false, pending: true })
      expect(
        reducePause(state, { type: 'blockersCleared' }, blocked).action,
      ).toBe('none')
      expect(
        reducePause(state, { type: 'blockersCleared' }, clearContext()).action,
      ).toBe('opened')
      expect(state).toEqual({ open: true, pending: false })
    },
  )

  it('opens on pointer-lock loss only while unobstructed play is active', () => {
    const state = createPauseState()
    const title = clearContext()
    title.titleOpen = true
    expect(reducePause(state, { type: 'pointerLockLost' }, title).action).toBe(
      'none',
    )

    const dialogue = clearContext()
    dialogue.dialogueOpen = true
    expect(
      reducePause(state, { type: 'pointerLockLost' }, dialogue).action,
    ).toBe('none')

    expect(
      reducePause(state, { type: 'pointerLockLost' }, clearContext()).action,
    ).toBe('opened')
    expect(
      reducePause(state, { type: 'pointerLockLost' }, clearContext()).action,
    ).toBe('none')
  })

  it('defers an explicit or pointer-lock request while a transition is blocked', () => {
    const state = createPauseState()
    const loading = clearContext()
    loading.loading = true
    expect(reducePause(state, { type: 'open' }, loading).action).toBe(
      'deferred',
    )
    expect(state.pending).toBe(true)
    reducePause(state, { type: 'resume' }, loading)
    expect(state.pending).toBe(false)
    expect(
      reducePause(state, { type: 'pointerLockLost' }, loading).action,
    ).toBe('deferred')
  })

  it('returns no action for irrelevant blocker checks and repeated resume', () => {
    const state = createPauseState()
    expect(
      reducePause(state, { type: 'blockersCleared' }, clearContext()).action,
    ).toBe('none')
    expect(reducePause(state, { type: 'resume' }, clearContext()).action).toBe(
      'none',
    )
  })

  it('returns zero gameplay time while paused or on the title', () => {
    expect(gameplayDelta(0.1, false, false)).toBe(0.1)
    expect(gameplayDelta(0.1, true, false)).toBe(0)
    expect(gameplayDelta(0.1, false, true)).toBe(0)
    expect(gameplayDelta(-1, false, false)).toBe(0)
  })

  it('advances the shared clock only during unpaused gameplay', () => {
    resetPauseRuntime()
    advancePausableClock(1)
    expect(getPauseRuntimeSnapshot().elapsedSeconds).toBe(1)
    setTitleScreenOpen(true)
    advancePausableClock(30)
    expect(getPauseRuntimeSnapshot().elapsedSeconds).toBe(1)
    setTitleScreenOpen(false)
    setPauseOpen(true)
    advancePausableClock(30)
    expect(getPauseRuntimeSnapshot().elapsedSeconds).toBe(1)
    setPauseOpen(false)
    advancePausableClock(2)
    expect(getPauseRuntimeSnapshot().elapsedSeconds).toBe(3)
    resetPauseRuntime()
  })
})
