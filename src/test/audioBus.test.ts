import { describe, expect, it } from 'vitest'
import {
  audioBus,
  createAudioBus,
  createAudioEvent,
  emitAudioEvent,
  readAudioEvent,
  resetAudioBus,
} from '../game/audio/audioBus'

describe('audio event bus', () => {
  it('keeps emission order and reuses a caller-owned output', () => {
    const bus = createAudioBus(3)
    const output = createAudioEvent()
    expect(emitAudioEvent(bus, 'cast-whistle', 1, 2, 3)).toBe(1)
    expect(emitAudioEvent(bus, 'recall-rattle', 4, 5, 6)).toBe(2)
    expect(readAudioEvent(bus, output)).toBe(output)
    expect(output).toEqual({
      sequence: 1,
      id: 'cast-whistle',
      value0: 1,
      value1: 2,
      value2: 3,
    })
    expect(readAudioEvent(bus, output)).toBe(output)
    expect(output.sequence).toBe(2)
    expect(output.id).toBe('recall-rattle')
    expect(readAudioEvent(bus, output)).toBeNull()
  })

  it('wraps and drops the oldest event when full', () => {
    const bus = createAudioBus(2)
    const output = createAudioEvent()
    emitAudioEvent(bus, 'cast-whistle')
    emitAudioEvent(bus, 'cord-snap')
    emitAudioEvent(bus, 'recall-rattle')
    expect(bus.size).toBe(2)
    expect(bus.dropped).toBe(1)
    readAudioEvent(bus, output)
    expect(output.id).toBe('cord-snap')
    readAudioEvent(bus, output)
    expect(output.id).toBe('recall-rattle')

    emitAudioEvent(bus, 'cord-cut')
    readAudioEvent(bus, output)
    expect(output.id).toBe('cord-cut')
  })

  it('works without a consumer and validates capacity', () => {
    const bus = createAudioBus(1)
    for (let index = 0; index < 10; index += 1)
      emitAudioEvent(bus, 'footstep', index)
    expect(bus.size).toBe(1)
    expect(bus.dropped).toBe(9)
    expect(() => createAudioBus(0)).toThrow('positive integer')
    expect(() => createAudioBus(1.5)).toThrow('positive integer')
  })

  it('provides and resets the shared main-bundle bus in place', () => {
    expect(audioBus.slots).toHaveLength(64)
    emitAudioEvent(audioBus, 'scene-change')
    resetAudioBus(audioBus)
    expect(audioBus).toMatchObject({
      readIndex: 0,
      writeIndex: 0,
      size: 0,
      dropped: 0,
      nextSequence: 1,
    })
  })
})
