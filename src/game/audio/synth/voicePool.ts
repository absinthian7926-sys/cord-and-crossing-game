import { AUDIO } from '../../../data/audio'
import type { AudioEvent } from '../audioBus'

type VoiceSlot = {
  readonly gain: GainNode
  readonly filter: BiquadFilterNode
  oscillatorOne: OscillatorNode | null
  oscillatorTwo: OscillatorNode | null
  noise: AudioBufferSourceNode | null
  active: boolean
  priority: number
  startedAt: number
  endsAt: number
}

export type SfxVoicePool = {
  readonly context: AudioContext
  readonly slots: VoiceSlot[]
  readonly output: AudioNode
}

function createSlot(context: AudioContext, output: AudioNode): VoiceSlot {
  const gain = context.createGain()
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = AUDIO.buses.openLowpassHz
  gain.gain.value = 0
  filter.connect(gain).connect(output)
  return {
    gain,
    filter,
    oscillatorOne: null,
    oscillatorTwo: null,
    noise: null,
    active: false,
    priority: 0,
    startedAt: 0,
    endsAt: 0,
  }
}

export function createSfxVoicePool(
  context: AudioContext,
  output: AudioNode,
): SfxVoicePool {
  const slots = new Array<VoiceSlot>(AUDIO.engine.voiceCap)
  for (let index = 0; index < slots.length; index += 1)
    slots[index] = createSlot(context, output)
  return { context, slots, output }
}

function stopSource(
  source: AudioScheduledSourceNode | null,
  now: number,
): void {
  if (source === null) return
  try {
    source.stop(now)
  } catch {
    // A source may already have ended between animation frames.
  }
  source.disconnect()
}

function resetSlot(slot: VoiceSlot, now: number): void {
  stopSource(slot.oscillatorOne, now)
  stopSource(slot.oscillatorTwo, now)
  stopSource(slot.noise, now)
  slot.oscillatorOne = null
  slot.oscillatorTwo = null
  slot.noise = null
  slot.active = false
  slot.gain.gain.cancelScheduledValues(now)
  slot.gain.gain.setValueAtTime(0, now)
}

function selectSlot(
  pool: SfxVoicePool,
  priority: number,
  now: number,
): VoiceSlot | null {
  let selected = pool.slots[0]
  let oldestTime = Number.POSITIVE_INFINITY
  let oldestPriority = Number.POSITIVE_INFINITY
  for (let index = 0; index < pool.slots.length; index += 1) {
    const slot = pool.slots[index]
    if (slot.active && slot.endsAt <= now) resetSlot(slot, now)
    if (!slot.active) return slot
    if (
      slot.priority < oldestPriority ||
      (slot.priority === oldestPriority && slot.startedAt < oldestTime)
    ) {
      selected = slot
      oldestPriority = slot.priority
      oldestTime = slot.startedAt
    }
  }
  return oldestPriority > priority ? null : selected
}

function oscillator(
  pool: SfxVoicePool,
  slot: VoiceSlot,
  type: OscillatorType,
  frequency: number,
  endFrequency: number,
  now: number,
  duration: number,
  second: boolean,
): void {
  const source = pool.context.createOscillator()
  source.type = type
  source.frequency.setValueAtTime(Math.max(1, frequency), now)
  source.frequency.exponentialRampToValueAtTime(
    Math.max(1, endFrequency),
    now + duration,
  )
  source.connect(slot.filter)
  source.start(now)
  source.stop(now + duration)
  if (second) slot.oscillatorTwo = source
  else slot.oscillatorOne = source
}

function noise(
  pool: SfxVoicePool,
  slot: VoiceSlot,
  buffer: AudioBuffer,
  now: number,
  duration: number,
  playbackRate: number,
): void {
  const source = pool.context.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = playbackRate
  source.connect(slot.filter)
  source.start(now)
  source.stop(now + duration)
  slot.noise = source
}

function envelope(
  slot: VoiceSlot,
  now: number,
  peak: number,
  duration: number,
): void {
  const attack = Math.min(
    AUDIO.synthesis.envelopeAttackSeconds,
    duration * AUDIO.synthesis.envelopeAttackFraction,
  )
  const silence = AUDIO.synthesis.silenceGain
  slot.gain.gain.cancelScheduledValues(now)
  slot.gain.gain.setValueAtTime(silence, now)
  slot.gain.gain.exponentialRampToValueAtTime(
    Math.max(silence, peak),
    now + attack,
  )
  slot.gain.gain.exponentialRampToValueAtTime(silence, now + duration)
}

export function playSfxEvent(
  pool: SfxVoicePool,
  event: AudioEvent,
  noiseBuffer: AudioBuffer,
): boolean {
  if (
    event.id === 'heelstone-hiss-start' ||
    event.id === 'heelstone-hiss-stop' ||
    event.id === 'scene-change'
  )
    return false

  const now = pool.context.currentTime
  const priority = event.id === 'footstep' ? 0 : 1
  const slot = selectSlot(pool, priority, now)
  if (slot === null) return false
  resetSlot(slot, now)
  slot.active = true
  slot.priority = priority
  slot.startedAt = now
  slot.filter.type = 'lowpass'
  slot.filter.frequency.setValueAtTime(AUDIO.buses.openLowpassHz, now)
  const cues = AUDIO.synthesis.cues
  let duration: number = AUDIO.hits.fleshDurationSeconds
  let gain: number = event.value1 > 0 ? event.value1 : cues.flesh.gain

  if (event.id === 'cast-whistle') {
    duration = cues.castWhistle.durationSeconds
    const pitch = event.value0 > 0 ? event.value0 : 1
    oscillator(
      pool,
      slot,
      'sine',
      cues.castWhistle.startHz * pitch,
      cues.castWhistle.endHz * pitch,
      now,
      duration,
      false,
    )
    gain = cues.castWhistle.gain
  } else if (event.id === 'cord-snap') {
    duration = cues.cordSnap.durationSeconds
    slot.filter.frequency.setValueAtTime(cues.cordSnap.filterHz, now)
    noise(pool, slot, noiseBuffer, now, duration, cues.cordSnap.playbackRate)
    gain = cues.cordSnap.gain
  } else if (event.id === 'recall-rattle') {
    duration = cues.recallRattle.durationSeconds
    slot.filter.type = 'bandpass'
    slot.filter.frequency.setValueAtTime(cues.recallRattle.filterHz, now)
    noise(
      pool,
      slot,
      noiseBuffer,
      now,
      duration,
      cues.recallRattle.playbackRate,
    )
    gain = cues.recallRattle.gain
  } else if (event.id === 'cord-cut') {
    duration = cues.cordCut.durationSeconds
    oscillator(
      pool,
      slot,
      'sine',
      cues.cordCut.startHz,
      cues.cordCut.endHz,
      now,
      duration,
      false,
    )
    noise(pool, slot, noiseBuffer, now, duration, cues.cordCut.playbackRate)
    gain = cues.cordCut.gain
  } else if (event.id === 'portico-bell') {
    duration = cues.porticoBell.durationSeconds
    oscillator(
      pool,
      slot,
      'sine',
      cues.porticoBell.frequenciesHz[0],
      cues.porticoBell.endFrequenciesHz[0],
      now,
      duration,
      false,
    )
    oscillator(
      pool,
      slot,
      'sine',
      cues.porticoBell.frequenciesHz[1],
      cues.porticoBell.endFrequenciesHz[1],
      now,
      duration,
      true,
    )
    gain = cues.porticoBell.gain
  } else if (event.id === 'heelstone-chime') {
    duration = cues.heelstoneChime.durationSeconds
    oscillator(
      pool,
      slot,
      'sine',
      cues.heelstoneChime.startHz,
      cues.heelstoneChime.endHz,
      now,
      duration,
      false,
    )
    gain = cues.heelstoneChime.gain
  } else if (event.id === 'footstep') {
    duration = cues.footstep.durationSeconds
    const surface = event.value0
    const pitch = event.value2 > 0 ? event.value2 : 1
    if (surface === AUDIO.footsteps.surfaces.stone) {
      slot.filter.type = 'bandpass'
      slot.filter.frequency.setValueAtTime(AUDIO.footsteps.stoneBandpassHz, now)
      oscillator(
        pool,
        slot,
        'sine',
        AUDIO.footsteps.stoneBodyHz * pitch,
        cues.footstep.stoneEndHz * pitch,
        now,
        duration,
        false,
      )
    } else if (surface === AUDIO.footsteps.surfaces.wood) {
      slot.filter.type = 'bandpass'
      slot.filter.frequency.setValueAtTime(cues.footstep.woodFilterHz, now)
    } else
      slot.filter.frequency.setValueAtTime(AUDIO.footsteps.dirtLowpassHz, now)
    noise(pool, slot, noiseBuffer, now, duration, pitch)
    gain = event.value1 > 0 ? event.value1 : AUDIO.footsteps.gain
  } else if (event.id === 'landing') {
    duration = cues.landing.durationSeconds
    oscillator(
      pool,
      slot,
      'sine',
      cues.landing.startHz,
      cues.landing.endHz,
      now,
      duration,
      false,
    )
    noise(
      pool,
      slot,
      noiseBuffer,
      now,
      cues.landing.noiseSeconds,
      cues.landing.playbackRate,
    )
    gain = cues.landing.gain
  } else if (event.id === 'hit-block') {
    duration = AUDIO.hits.blockDurationSeconds
    const pitch = 2 ** (event.value2 / AUDIO.pitch.semitonesPerOctave)
    oscillator(
      pool,
      slot,
      'square',
      AUDIO.hits.blockPartialOneHz * pitch,
      cues.block.endFrequenciesHz[0] * pitch,
      now,
      duration,
      false,
    )
    oscillator(
      pool,
      slot,
      'square',
      AUDIO.hits.blockPartialTwoHz * pitch,
      cues.block.endFrequenciesHz[1] * pitch,
      now,
      duration,
      true,
    )
    gain = event.value1 > 0 ? event.value1 : cues.block.gain
  } else if (event.id === 'player-hurt') {
    duration = AUDIO.hits.hurtDurationSeconds
    oscillator(
      pool,
      slot,
      'sine',
      AUDIO.hits.hurtBodyHz,
      cues.hurt.endHz,
      now,
      duration,
      false,
    )
    noise(pool, slot, noiseBuffer, now, duration, cues.hurt.playbackRate)
    gain = cues.hurt.gain
  } else if (event.id === 'arrow-terrain') {
    duration = cues.arrow.durationSeconds
    slot.filter.type = 'bandpass'
    slot.filter.frequency.setValueAtTime(cues.arrow.filterHz, now)
    noise(pool, slot, noiseBuffer, now, duration, cues.arrow.playbackRate)
    gain = cues.arrow.gain
  } else {
    duration = AUDIO.hits.fleshDurationSeconds
    oscillator(
      pool,
      slot,
      'sine',
      AUDIO.hits.fleshBodyHz,
      cues.flesh.endHz,
      now,
      duration,
      false,
    )
    noise(
      pool,
      slot,
      noiseBuffer,
      now,
      cues.flesh.noiseSeconds,
      cues.flesh.playbackRate,
    )
    gain = event.value1 > 0 ? event.value1 : cues.flesh.gain
  }

  envelope(slot, now, gain, duration)
  slot.endsAt = now + duration
  return true
}

export function countActiveSfxVoices(pool: SfxVoicePool): number {
  const now = pool.context.currentTime
  let count = 0
  for (let index = 0; index < pool.slots.length; index += 1) {
    const slot = pool.slots[index]
    if (slot.active && slot.endsAt <= now) resetSlot(slot, now)
    if (slot.active) count += 1
  }
  return count
}

export function disposeSfxVoicePool(pool: SfxVoicePool): void {
  const now = pool.context.currentTime
  for (let index = 0; index < pool.slots.length; index += 1)
    resetSlot(pool.slots[index], now)
}
