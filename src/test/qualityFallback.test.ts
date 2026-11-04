import { describe, expect, it } from 'vitest'
import {
  createQualityFallbackState,
  qualityFallbackToast,
  stepQualityFallback,
  type QualityFallbackInput,
} from '../game/settings/qualityFallback'

const input = (
  overrides: Partial<QualityFallbackInput> = {},
): QualityFallbackInput => ({
  fps: 60,
  deltaSeconds: 1,
  quality: 'High',
  qualityChosenByHand: false,
  paused: false,
  loading: false,
  titleOpen: false,
  ...overrides,
})

describe('automatic quality fallback', () => {
  it('does not drop at or above 45 fps and resets a pending timer', () => {
    const state = createQualityFallbackState()
    state.belowThresholdSeconds = 7
    expect(stepQualityFallback(state, input({ fps: 45 }))).toBeNull()
    expect(state.belowThresholdSeconds).toBe(0)
    state.belowThresholdSeconds = 7
    expect(stepQualityFallback(state, input({ fps: Number.NaN }))).toBeNull()
    expect(state.belowThresholdSeconds).toBe(0)
  })

  it('drops High to Medium after 8 continuous seconds below 45 fps', () => {
    const state = createQualityFallbackState()
    expect(
      stepQualityFallback(state, input({ fps: 44, deltaSeconds: 7.9 })),
    ).toBeNull()
    expect(
      stepQualityFallback(state, input({ fps: 44, deltaSeconds: 0.1 })),
    ).toBe('Medium')
    expect(state.droppedFromHigh).toBe(true)
  })

  it('drops each tier at most once and never drops below Low', () => {
    const state = createQualityFallbackState()
    expect(
      stepQualityFallback(state, input({ fps: 44, deltaSeconds: 8 })),
    ).toBe('Medium')
    expect(
      stepQualityFallback(state, input({ fps: 44, deltaSeconds: 8 })),
    ).toBeNull()
    expect(
      stepQualityFallback(
        state,
        input({ quality: 'Medium', fps: 44, deltaSeconds: 8 }),
      ),
    ).toBe('Low')
    expect(
      stepQualityFallback(
        state,
        input({ quality: 'Medium', fps: 44, deltaSeconds: 8 }),
      ),
    ).toBeNull()
    expect(
      stepQualityFallback(
        state,
        input({ quality: 'Low', fps: 1, deltaSeconds: 20 }),
      ),
    ).toBeNull()
  })

  it.each([
    { qualityChosenByHand: true },
    { paused: true },
    { loading: true },
    { titleOpen: true },
  ] satisfies Array<Partial<QualityFallbackInput>>)(
    'does not count time while gameplay is inactive: %o',
    (override) => {
      const state = createQualityFallbackState()
      state.belowThresholdSeconds = 4
      expect(
        stepQualityFallback(
          state,
          input({ fps: 1, deltaSeconds: 20, ...override }),
        ),
      ).toBeNull()
      expect(state.belowThresholdSeconds).toBe(0)
    },
  )

  it('ignores invalid time and formats the exact toast', () => {
    const state = createQualityFallbackState()
    expect(
      stepQualityFallback(
        state,
        input({ fps: 1, deltaSeconds: Number.NaN }),
      ),
    ).toBeNull()
    expect(stepQualityFallback(state, input({ fps: 1, deltaSeconds: 0 }))).toBe(
      null,
    )
    expect(qualityFallbackToast('Low')).toBe(
      'Graphics set to Low for smoother play. Change it in Pause, Graphics.',
    )
  })
})
