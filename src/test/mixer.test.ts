import { describe, expect, it } from 'vitest'
import { AUDIO } from '../data/audio'
import {
  BUS_GRAPH,
  createMixerFrame,
  decibelsToGain,
  resolveMixerFrame,
  sliderToGain,
  startMusicDuck,
  stepMusicDuck,
} from '../game/audio/mixer'

describe('audio mixer rules', () => {
  it('maps slider endpoints and the midpoint with a squared curve', () => {
    expect(sliderToGain(0)).toBe(0)
    expect(sliderToGain(100)).toBe(1)
    expect(sliderToGain(50)).toBe(0.25)
    expect(sliderToGain(-20)).toBe(0)
    expect(sliderToGain(120)).toBe(1)
    expect(Number.isFinite(sliderToGain(Number.NaN))).toBe(true)
  })

  it('describes the required master bus graph and mute rule', () => {
    expect(BUS_GRAPH).toEqual({
      master: ['music', 'sfx', 'ambient'],
      compressor: { thresholdDb: -12, ratio: 3 },
    })
    expect(AUDIO.buses.defaults).toEqual({
      master: 80,
      music: 50,
      sfx: 80,
      ambient: 60,
    })
    expect(sliderToGain(0)).toBe(0)
  })

  it('ducks music and restores it after the exact timer', () => {
    const frame = createMixerFrame()
    let remaining = startMusicDuck()
    expect(remaining).toBe(1.5)
    resolveMixerFrame(false, remaining, frame)
    expect(frame.musicGainMultiplier).toBeCloseTo(decibelsToGain(-6))
    expect(stepMusicDuck(remaining, 1)).toBeCloseTo(0.5)
    remaining = stepMusicDuck(remaining, 1.5)
    expect(remaining).toBe(0)
    resolveMixerFrame(false, remaining, frame)
    expect(frame.musicGainMultiplier).toBe(1)
    expect(stepMusicDuck(remaining, -1)).toBe(0)
  })

  it('applies pause filtering, attenuation and sfx suppression', () => {
    const frame = createMixerFrame()
    expect(resolveMixerFrame(true, 1, frame)).toBe(frame)
    expect(frame.musicLowpassHz).toBe(800)
    expect(frame.ambientLowpassHz).toBe(800)
    expect(frame.musicGainMultiplier).toBeCloseTo(decibelsToGain(-15))
    expect(frame.ambientGainMultiplier).toBeCloseTo(decibelsToGain(-9))
    expect(frame.allowNewSfx).toBe(false)

    resolveMixerFrame(false, 0, frame)
    expect(frame.musicLowpassHz).toBe(AUDIO.buses.openLowpassHz)
    expect(frame.ambientLowpassHz).toBe(AUDIO.buses.openLowpassHz)
    expect(frame.ambientGainMultiplier).toBe(1)
    expect(frame.allowNewSfx).toBe(true)
  })
})
