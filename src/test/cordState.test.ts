import { describe, expect, it } from 'vitest'
import { REACHBLADE } from '../data/weapons'
import {
  canCloseStrike,
  canCordBeCut,
  initialCordState,
  isUnarmed,
  step,
  type CordEvent,
  type CordMode,
  type CordState,
} from '../game/weapons/cordState'

const state = (mode: CordMode, retieRemaining = 0): CordState => ({
  mode,
  castKind: mode === 'Out' ? 'straight' : null,
  retieRemaining,
})

describe('cord state machine', () => {
  it('starts in hand', () => {
    expect(initialCordState()).toEqual({
      mode: 'InHand',
      castKind: null,
      retieRemaining: 0,
    })
  })

  it('releases straight and arc casts only from InHand', () => {
    expect(step(initialCordState(), { type: 'castRelease' })).toMatchObject({
      mode: 'Out',
      castKind: 'straight',
    })
    expect(step(initialCordState(), { type: 'arcRelease' })).toMatchObject({
      mode: 'Out',
      castKind: 'arc',
    })
    const out = state('Out')
    expect(step(out, { type: 'castRelease' })).toBe(out)
    expect(step(out, { type: 'arcRelease' })).toBe(out)
  })

  it.each(['hit', 'maxRange', 'recallPressed'] as const)(
    '%s starts recall from Out and is otherwise a no-op',
    (type) => {
      const out = state('Out')
      expect(step(out, { type })).toMatchObject({
        mode: 'Returning',
        castKind: 'straight',
      })
      const returning = state('Returning')
      expect(step(returning, { type })).toBe(returning)
    },
  )

  it('drops on a double stop tap from Out or Returning', () => {
    expect(step(state('Out'), { type: 'stopDoubleTap' }).mode).toBe('Dropped')
    expect(step(state('Returning'), { type: 'stopDoubleTap' }).mode).toBe(
      'Dropped',
    )
    const inHand = initialCordState()
    expect(step(inHand, { type: 'stopDoubleTap' })).toBe(inHand)
  })

  it('returns to hand only from Returning', () => {
    expect(step(state('Returning'), { type: 'returned' }).mode).toBe('InHand')
    const out = state('Out')
    expect(step(out, { type: 'returned' })).toBe(out)
  })

  it('cuts Out or Returning and ignores cut elsewhere', () => {
    for (const mode of ['Out', 'Returning'] as const) {
      expect(step(state(mode), { type: 'cut' })).toEqual({
        mode: 'Cut',
        castKind: null,
        retieRemaining: REACHBLADE.cut.retieSeconds,
      })
    }
    const dropped = state('Dropped')
    expect(step(dropped, { type: 'cut' })).toBe(dropped)
  })

  it('ticks the cut timer without accepting negative time', () => {
    const cut = state('Cut', 2)
    expect(step(cut, { type: 'tick' }, 0.5).retieRemaining).toBe(1.5)
    expect(step(cut, { type: 'tick' }, -1).retieRemaining).toBe(2)
    const inHand = initialCordState()
    expect(step(inHand, { type: 'tick' }, 1)).toBe(inHand)
    const finished = state('Cut', 0)
    expect(step(finished, { type: 'tick' }, 1)).toBe(finished)
  })

  it('finishes re-tie only when the timer reaches zero', () => {
    expect(step(state('Cut', 0), { type: 'retieDone' }).mode).toBe('InHand')
    const active = state('Cut', 0.1)
    expect(step(active, { type: 'retieDone' })).toBe(active)
    const dropped = state('Dropped')
    expect(step(dropped, { type: 'retieDone' })).toBe(dropped)
  })

  it('picks up only a dropped blade', () => {
    expect(step(state('Dropped'), { type: 'pickup' }).mode).toBe('InHand')
    const cut = state('Cut', 1)
    expect(step(cut, { type: 'pickup' })).toBe(cut)
  })

  it('reports armed, unarmed and cuttable modes', () => {
    for (const mode of [
      'InHand',
      'Out',
      'Returning',
      'Cut',
      'Dropped',
    ] as const) {
      const cord = state(mode)
      expect(isUnarmed(cord)).toBe(mode !== 'InHand')
      expect(canCloseStrike(cord)).toBe(mode === 'InHand')
      expect(canCordBeCut(cord)).toBe(mode === 'Out' || mode === 'Returning')
    }
  })

  it('treats every unsupported InHand event as a no-op', () => {
    const cord = initialCordState()
    const events: CordEvent[] = [
      { type: 'hit' },
      { type: 'maxRange' },
      { type: 'recallPressed' },
      { type: 'returned' },
      { type: 'cut' },
      { type: 'retieDone' },
      { type: 'pickup' },
      { type: 'tick' },
    ]
    for (const event of events) expect(step(cord, event, 1)).toBe(cord)
  })
})
