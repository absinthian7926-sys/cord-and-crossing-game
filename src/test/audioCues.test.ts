import { describe, expect, it } from 'vitest'
import {
  createAmbientMix,
  createHitCueDecision,
  createPorticoProximity,
  isNearZoneRope,
  resolveAmbientMix,
  resolveCrossingCue,
  resolveHeelstoneCue,
  resolveHitCue,
  resolvePorticoProximity,
  surfGainAtX,
  whistlePitchForSpeed,
} from '../game/audio/audioCues'

describe('audio cue decisions', () => {
  it.each([
    [25, 0, 1, 400],
    [20, 0, 1, 400],
    [11, 0.5, Math.pow(2, 1 / 12), 1200],
    [2, 1, Math.pow(2, 2 / 12), 2000],
    [1, 1, Math.pow(2, 2 / 12), 2000],
  ])('resolves portico proximity at %s m', (distance, gain, pitch, lowpass) => {
    const output = createPorticoProximity()
    expect(resolvePorticoProximity('zone', true, distance, output)).toBe(output)
    expect(output.gain).toBeCloseTo(gain)
    expect(output.pitchRatio).toBeCloseTo(pitch)
    expect(output.lowpassHz).toBeCloseTo(lowpass)
  })

  it('keeps the locked zone screen silent and the Hollow screen active', () => {
    const output = createPorticoProximity()
    resolvePorticoProximity('zone', false, 2, output)
    expect(output.gain).toBe(0)
    resolvePorticoProximity('hollow', false, 2, output)
    expect(output.gain).toBe(1)
  })

  it.each([
    [0, 0.8],
    [11, 1],
    [22, 1.2],
    [44, 1.2],
    [-1, 0.8],
  ])('maps cast speed %s to whistle pitch %s', (speed, pitch) => {
    expect(whistlePitchForSpeed(speed)).toBeCloseTo(pitch)
  })

  it('emits a bell only for a valid crossing', () => {
    expect(resolveCrossingCue('valid')).toBe('portico-bell')
    expect(resolveCrossingCue('partial')).toBeNull()
    expect(resolveCrossingCue('reversed')).toBeNull()
    expect(resolveCrossingCue('side')).toBeNull()
  })

  it('emits heelstone hiss lifecycle cues and chimes only on completion', () => {
    expect(resolveHeelstoneCue('started')).toBe('heelstone-hiss-start')
    expect(resolveHeelstoneCue('completed')).toBe('heelstone-chime')
    expect(resolveHeelstoneCue('interrupted')).toBe('heelstone-hiss-stop')
    expect(resolveHeelstoneCue('cancelled')).toBe('heelstone-hiss-stop')
  })

  it('fades zone surf by x and gates gulls at the coast', () => {
    expect(surfGainAtX(-200)).toBe(1)
    expect(surfGainAtX(-150)).toBe(1)
    expect(surfGainAtX(75)).toBeCloseTo(0.625)
    expect(surfGainAtX(300)).toBe(0.25)
    expect(surfGainAtX(400)).toBe(0.25)

    const output = createAmbientMix()
    expect(resolveAmbientMix('zone', -150, true, true, output)).toBe(output)
    expect(output).toEqual({
      wind: 1,
      surf: 1,
      gulls: 1,
      ropeCreak: 1,
      waystation: 1,
    })
    resolveAmbientMix('zone', 101, false, false, output)
    expect(output.gulls).toBe(0)
    expect(output.ropeCreak).toBe(0)
    expect(output.waystation).toBe(0)
  })

  it('uses the sheltered Hollow ambient table', () => {
    const output = createAmbientMix()
    resolveAmbientMix('hollow', -150, true, true, output)
    expect(output).toEqual({
      wind: 0.4,
      surf: 0.15,
      gulls: 0,
      ropeCreak: 1,
      waystation: 0,
    })
    resolveAmbientMix('hollow', 0, false, false, output)
    expect(output.ropeCreak).toBe(0)
  })

  it('enables rope creaks by the cliff path and waystation shelter', () => {
    expect(isNearZoneRope(200, 200, 0)).toBe(true)
    expect(isNearZoneRope(-7, 3, 100)).toBe(true)
    expect(isNearZoneRope(8, 3, 100)).toBe(true)
    expect(isNearZoneRope(9, 3, 100)).toBe(false)
  })

  it.each([
    ['flesh', 'hit-flesh', null, 1, 0],
    ['strike3', 'hit-flesh', null, 1.15, 0],
    ['block', 'hit-block', null, 1, 0],
    ['hurt', 'player-hurt', null, 1, 0],
    ['arrow', 'arrow-terrain', null, 1, 0],
    ['guardBreak', 'hit-block', 'hit-flesh', 1, -3],
  ] as const)(
    'maps %s hit feedback',
    (kind, primary, secondary, gain, pitchSemitones) => {
      const output = createHitCueDecision()
      expect(resolveHitCue(kind, output)).toBe(output)
      expect(output).toEqual({ primary, secondary, gain, pitchSemitones })
    },
  )
})
