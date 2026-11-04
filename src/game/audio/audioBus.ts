import { AUDIO } from '../../data/audio'
import type { AudioCueId } from './audioCues'

export type AudioEvent = {
  sequence: number
  id: AudioCueId
  value0: number
  value1: number
  value2: number
}

export type AudioBus = {
  readonly slots: AudioEvent[]
  readIndex: number
  writeIndex: number
  size: number
  dropped: number
  nextSequence: number
}

export function createAudioEvent(): AudioEvent {
  return {
    sequence: 0,
    id: 'scene-change',
    value0: 0,
    value1: 0,
    value2: 0,
  }
}

export function createAudioBus(
  capacity: number = AUDIO.engine.eventBusCapacity,
): AudioBus {
  if (!Number.isInteger(capacity) || capacity <= 0)
    throw new Error('Audio bus capacity must be a positive integer.')
  const slots = new Array<AudioEvent>(capacity)
  for (let index = 0; index < capacity; index += 1)
    slots[index] = createAudioEvent()
  return {
    slots,
    readIndex: 0,
    writeIndex: 0,
    size: 0,
    dropped: 0,
    nextSequence: 1,
  }
}

export function emitAudioEvent(
  bus: AudioBus,
  id: AudioCueId,
  value0 = 0,
  value1 = 0,
  value2 = 0,
): number {
  if (bus.size === bus.slots.length) {
    bus.readIndex = (bus.readIndex + 1) % bus.slots.length
    bus.size -= 1
    bus.dropped += 1
  }

  const sequence = bus.nextSequence
  bus.nextSequence += 1
  const slot = bus.slots[bus.writeIndex]
  slot.sequence = sequence
  slot.id = id
  slot.value0 = value0
  slot.value1 = value1
  slot.value2 = value2
  bus.writeIndex = (bus.writeIndex + 1) % bus.slots.length
  bus.size += 1
  return sequence
}

export function readAudioEvent(
  bus: AudioBus,
  output: AudioEvent,
): AudioEvent | null {
  if (bus.size === 0) return null
  const slot = bus.slots[bus.readIndex]
  output.sequence = slot.sequence
  output.id = slot.id
  output.value0 = slot.value0
  output.value1 = slot.value1
  output.value2 = slot.value2
  bus.readIndex = (bus.readIndex + 1) % bus.slots.length
  bus.size -= 1
  return output
}

export function resetAudioBus(bus: AudioBus): void {
  bus.readIndex = 0
  bus.writeIndex = 0
  bus.size = 0
  bus.dropped = 0
  bus.nextSequence = 1
}

export const audioBus = createAudioBus()
