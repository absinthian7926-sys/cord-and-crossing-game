import { describe, expect, it } from 'vitest'
import { EFFECTS } from '../data/effects'
import {
  createHeelstonePassState,
  stepHeelstonePass,
  type HeelstonePassState,
} from '../game/effects/heelstonePass'

const start = (state: HeelstonePassState, durationSeconds?: number) =>
  stepHeelstonePass(
    state,
    {
      type: 'start',
      activeEffectId: EFFECTS.strength.id,
      bladeInHand: true,
      lineAlreadyCarrying: false,
    },
    0,
    durationSeconds,
  )

describe('heelstone pass', () => {
  it('does nothing when F is pressed without an active effect', () => {
    const state = createHeelstonePassState()
    const returned = stepHeelstonePass(state, {
      type: 'start',
      activeEffectId: null,
      bladeInHand: true,
      lineAlreadyCarrying: false,
    })
    expect(returned).toBe(state)
    expect(state.mode).toBe('Idle')
  })

  it('requires the blade in hand and a plain line', () => {
    const noBlade = createHeelstonePassState()
    stepHeelstonePass(noBlade, {
      type: 'start',
      activeEffectId: EFFECTS.strength.id,
      bladeInHand: false,
      lineAlreadyCarrying: false,
    })
    expect(noBlade.mode).toBe('Idle')

    const carrying = createHeelstonePassState()
    stepHeelstonePass(carrying, {
      type: 'start',
      activeEffectId: EFFECTS.strength.id,
      bladeInHand: true,
      lineAlreadyCarrying: true,
    })
    expect(carrying.mode).toBe('Idle')
  })

  it('starts once and completes at exactly 1.2 seconds', () => {
    const state = createHeelstonePassState()
    expect(start(state)).toBe(state)
    expect(state).toEqual({
      mode: 'Passing',
      effectId: EFFECTS.strength.id,
      remainingSeconds: EFFECTS.heelstonePass.durationSeconds,
    })

    start(state)
    expect(state.remainingSeconds).toBe(EFFECTS.heelstonePass.durationSeconds)
    stepHeelstonePass(state, { type: 'tick' }, 1.19)
    expect(state.mode).toBe('Passing')
    stepHeelstonePass(state, { type: 'tick' }, 0.01)
    expect(state.mode).toBe('Carried')
    expect(state.remainingSeconds).toBe(0)
  })

  it('ignores negative tick time and ticks only while Passing', () => {
    const state = createHeelstonePassState()
    stepHeelstonePass(state, { type: 'tick' }, 2)
    start(state)
    stepHeelstonePass(state, { type: 'tick' }, -1)
    expect(state.remainingSeconds).toBe(EFFECTS.heelstonePass.durationSeconds)
    stepHeelstonePass(state, { type: 'tick' }, 2)
    expect(state.mode).toBe('Carried')
    stepHeelstonePass(state, { type: 'tick' }, 2)
    expect(state.mode).toBe('Carried')
  })

  it.each(['hit', 'dodge'] as const)(
    '%s interrupts at any point without removing the external effect',
    (type) => {
      const state = createHeelstonePassState()
      start(state)
      stepHeelstonePass(state, { type: 'tick' }, 0.6)
      stepHeelstonePass(state, { type })
      expect(state).toEqual({
        mode: 'Idle',
        effectId: null,
        remainingSeconds: 0,
      })
      stepHeelstonePass(state, { type })
      expect(state.mode).toBe('Idle')
    },
  )

  it.each(['cut', 'stop', 'death'] as const)(
    '%s makes a carried line plain',
    (type) => {
      const state = createHeelstonePassState()
      start(state, 0)
      stepHeelstonePass(state, { type: 'tick' })
      expect(state.mode).toBe('Carried')
      stepHeelstonePass(state, { type })
      expect(state.mode).toBe('Idle')
      stepHeelstonePass(state, { type })
      expect(state.mode).toBe('Idle')
    },
  )

  it('also cancels an incomplete pass when the line is cut', () => {
    const state = createHeelstonePassState()
    start(state)
    stepHeelstonePass(state, { type: 'cut' })
    expect(state.mode).toBe('Idle')
  })

  it.each(['effectExpired', 'effectRemoved'] as const)(
    '%s clears only the matching carried effect',
    (type) => {
      const state = createHeelstonePassState()
      start(state, 0)
      stepHeelstonePass(state, { type: 'tick' })
      stepHeelstonePass(state, { type, effectId: 'Other' })
      expect(state.mode).toBe('Carried')
      stepHeelstonePass(state, { type, effectId: EFFECTS.strength.id })
      expect(state.mode).toBe('Idle')
    },
  )
})
