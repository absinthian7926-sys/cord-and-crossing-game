import { AUDIO } from '../../../data/audio'
import type { AmbientMix, PorticoProximity } from '../audioCues'
import type { MusicLayer } from '../musicDirector'
import { nextSeededUnit } from './noise'

export type ContinuousSynth = {
  readonly noiseSource: AudioBufferSourceNode
  readonly windGain: GainNode
  readonly surfGain: GainNode
  readonly ropeGain: GainNode
  readonly waystationGain: GainNode
  readonly passGain: GainNode
  readonly gullGain: GainNode
  readonly gull: OscillatorNode
  readonly creakGain: GainNode
  readonly creak: OscillatorNode
  readonly woodGain: GainNode
  readonly wood: OscillatorNode
  readonly porticoGain: GainNode
  readonly porticoFilter: BiquadFilterNode
  readonly porticoOscillators: readonly OscillatorNode[]
  readonly exploreGain: GainNode
  readonly phraseGain: GainNode
  readonly combatGain: GainNode
  readonly stringOne: OscillatorNode
  readonly stringTwo: OscillatorNode
  readonly flute: OscillatorNode
  readonly fluteVibrato: OscillatorNode
  readonly fluteVibratoGain: GainNode
  readonly drum: OscillatorNode
  readonly drumNoiseGain: GainNode
  readonly musicState: Uint32Array
  nextPhraseTime: number
  nextDrumTime: number
  nextGullTime: number
  nextCreakTime: number
  nextWoodTime: number
  surfSwellStartedTime: number
  surfSwellSeconds: number
}

function gainNode(
  context: AudioContext,
  output: AudioNode,
  value = 0,
): GainNode {
  const gain = context.createGain()
  gain.gain.value = value
  gain.connect(output)
  return gain
}

function filteredNoiseBranch(
  context: AudioContext,
  source: AudioNode,
  output: AudioNode,
  type: BiquadFilterType,
  frequency: number,
): GainNode {
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  filter.type = type
  filter.frequency.value = frequency
  gain.gain.value = 0
  source.connect(filter).connect(gain).connect(output)
  return gain
}

export function createContinuousSynth(
  context: AudioContext,
  ambientOutput: AudioNode,
  musicOutput: AudioNode,
  noiseBuffer: AudioBuffer,
): ContinuousSynth {
  const musicState = new Uint32Array([AUDIO.music.seed])
  const noiseSource = context.createBufferSource()
  noiseSource.buffer = noiseBuffer
  noiseSource.loop = true

  const windGain = filteredNoiseBranch(
    context,
    noiseSource,
    ambientOutput,
    'lowpass',
    AUDIO.ambient.synthesis.windFilterHz,
  )
  const surfGain = filteredNoiseBranch(
    context,
    noiseSource,
    ambientOutput,
    'lowpass',
    AUDIO.ambient.synthesis.surfFilterHz,
  )
  const ropeGain = filteredNoiseBranch(
    context,
    noiseSource,
    ambientOutput,
    'bandpass',
    AUDIO.ambient.synthesis.ropeFilterHz,
  )
  const waystationGain = filteredNoiseBranch(
    context,
    noiseSource,
    ambientOutput,
    'lowpass',
    AUDIO.ambient.synthesis.waystationFilterHz,
  )
  const passGain = filteredNoiseBranch(
    context,
    noiseSource,
    ambientOutput,
    'highpass',
    AUDIO.ambient.synthesis.passFilterHz,
  )
  const gullGain = gainNode(context, ambientOutput)
  const gull = context.createOscillator()
  gull.type = 'sine'
  gull.frequency.value = AUDIO.ambient.synthesis.gullStartHz
  gull.connect(gullGain)
  const creakGain = gainNode(context, ambientOutput)
  const creak = context.createOscillator()
  creak.type = 'triangle'
  creak.frequency.value = AUDIO.ambient.synthesis.creakStartHz
  creak.connect(creakGain)
  const woodGain = gainNode(context, ambientOutput)
  const wood = context.createOscillator()
  wood.type = 'square'
  wood.frequency.value = AUDIO.ambient.synthesis.woodHz
  wood.connect(woodGain)

  const porticoGain = gainNode(context, ambientOutput)
  const porticoFilter = context.createBiquadFilter()
  porticoFilter.type = 'lowpass'
  porticoFilter.frequency.value = AUDIO.portico.minimumLowpassHz
  porticoFilter.connect(porticoGain)
  const porticoOscillators = AUDIO.portico.chordFrequenciesHz.map(
    (frequency) => {
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      oscillator.connect(porticoFilter)
      oscillator.start()
      return oscillator
    },
  )

  const exploreGain = gainNode(context, musicOutput, AUDIO.music.exploreGain)
  const phraseGain = gainNode(context, exploreGain, AUDIO.synthesis.silenceGain)
  const combatGain = gainNode(context, musicOutput, 0)
  const stringOne = context.createOscillator()
  const stringTwo = context.createOscillator()
  const flute = context.createOscillator()
  const fluteVibrato = context.createOscillator()
  const fluteVibratoGain = context.createGain()
  const drum = context.createOscillator()
  const drumNoiseGain = gainNode(context, combatGain)
  const stringFilter = context.createBiquadFilter()
  stringFilter.type = 'lowpass'
  stringFilter.frequency.value = AUDIO.music.stringFilterHz
  const fluteBreathGain = filteredNoiseBranch(
    context,
    noiseSource,
    phraseGain,
    'highpass',
    AUDIO.music.fluteBreathFilterHz,
  )
  fluteBreathGain.gain.value = AUDIO.music.fluteBreathGain
  stringOne.type = 'sawtooth'
  stringTwo.type = 'sawtooth'
  stringOne.detune.value = -AUDIO.music.stringDetuneCents
  stringTwo.detune.value = AUDIO.music.stringDetuneCents
  stringOne.frequency.value = AUDIO.music.scaleFrequenciesHz[0]
  stringTwo.frequency.value = AUDIO.music.scaleFrequenciesHz[0]
  flute.type = 'sine'
  flute.frequency.value = AUDIO.music.fluteFrequencyHz
  fluteVibrato.type = 'sine'
  fluteVibrato.frequency.value = AUDIO.music.vibratoHz
  fluteVibratoGain.gain.value = AUDIO.music.fluteVibratoDepthHz
  fluteVibrato.connect(fluteVibratoGain).connect(flute.frequency)
  drum.type = 'sine'
  drum.frequency.value = AUDIO.music.drumEndHz
  stringOne.connect(stringFilter)
  stringTwo.connect(stringFilter)
  stringFilter.connect(phraseGain)
  flute.connect(phraseGain)
  drum.connect(combatGain)
  noiseSource.connect(drumNoiseGain)

  noiseSource.start()
  gull.start()
  creak.start()
  wood.start()
  stringOne.start()
  stringTwo.start()
  flute.start()
  fluteVibrato.start()
  drum.start()

  return {
    noiseSource,
    windGain,
    surfGain,
    ropeGain,
    waystationGain,
    passGain,
    gullGain,
    gull,
    creakGain,
    creak,
    woodGain,
    wood,
    porticoGain,
    porticoFilter,
    porticoOscillators,
    exploreGain,
    phraseGain,
    combatGain,
    stringOne,
    stringTwo,
    flute,
    fluteVibrato,
    fluteVibratoGain,
    drum,
    drumNoiseGain,
    musicState,
    nextPhraseTime: context.currentTime,
    nextDrumTime: context.currentTime,
    nextGullTime: context.currentTime + AUDIO.ambient.gullMinimumSeconds,
    nextCreakTime: context.currentTime + AUDIO.ambient.ropeCreakMinimumSeconds,
    nextWoodTime:
      context.currentTime + AUDIO.ambient.synthesis.woodMinimumSeconds,
    surfSwellStartedTime: context.currentTime,
    surfSwellSeconds:
      AUDIO.ambient.surfSwellMinimumSeconds +
      nextSeededUnit(musicState) *
        (AUDIO.ambient.surfSwellMaximumSeconds -
          AUDIO.ambient.surfSwellMinimumSeconds),
  }
}

function target(
  parameter: AudioParam,
  value: number,
  now: number,
  seconds: number = AUDIO.synthesis.targetRampSeconds,
): void {
  parameter.setTargetAtTime(value, now, seconds)
}

export function updateContinuousSynth(
  synth: ContinuousSynth,
  context: AudioContext,
  ambient: AmbientMix,
  portico: PorticoProximity,
  musicLayer: MusicLayer,
  musicMultiplier: number,
  ambientMultiplier: number,
  titleOpen: boolean,
): void {
  const now = context.currentTime
  const windLfo =
    AUDIO.ambient.synthesis.windBase +
    Math.sin(now * Math.PI * 2 * AUDIO.ambient.windLfoHz) *
      AUDIO.ambient.synthesis.windAmplitude
  target(
    synth.windGain.gain,
    ambient.wind *
      windLfo *
      AUDIO.ambient.synthesis.windGain *
      ambientMultiplier,
    now,
  )
  if (now >= synth.surfSwellStartedTime + synth.surfSwellSeconds) {
    synth.surfSwellStartedTime = now
    synth.surfSwellSeconds =
      AUDIO.ambient.surfSwellMinimumSeconds +
      nextSeededUnit(synth.musicState) *
        (AUDIO.ambient.surfSwellMaximumSeconds -
          AUDIO.ambient.surfSwellMinimumSeconds)
  }
  const surfProgress =
    (now - synth.surfSwellStartedTime) / synth.surfSwellSeconds
  const surfSwell =
    AUDIO.ambient.synthesis.surfSwellBase +
    Math.sin(surfProgress * Math.PI * 2) *
      AUDIO.ambient.synthesis.surfSwellAmplitude
  target(
    synth.surfGain.gain,
    ambient.surf *
      surfSwell *
      AUDIO.ambient.synthesis.surfGain *
      ambientMultiplier,
    now,
  )
  target(
    synth.ropeGain.gain,
    ambient.ropeCreak * AUDIO.ambient.synthesis.ropeGain * ambientMultiplier,
    now,
  )
  target(
    synth.waystationGain.gain,
    ambient.waystation *
      AUDIO.ambient.synthesis.waystationGain *
      ambientMultiplier,
    now,
  )
  if (ambient.gulls > 0 && now >= synth.nextGullTime) {
    synth.gull.frequency.cancelScheduledValues(now)
    synth.gull.frequency.setValueAtTime(
      AUDIO.ambient.synthesis.gullStartHz,
      now,
    )
    synth.gull.frequency.exponentialRampToValueAtTime(
      AUDIO.ambient.synthesis.gullPeakHz,
      now + AUDIO.ambient.synthesis.gullRiseSeconds,
    )
    synth.gull.frequency.exponentialRampToValueAtTime(
      AUDIO.ambient.synthesis.gullEndHz,
      now + AUDIO.ambient.synthesis.gullFallSeconds,
    )
    synth.gullGain.gain.cancelScheduledValues(now)
    synth.gullGain.gain.setValueAtTime(AUDIO.synthesis.silenceGain, now)
    synth.gullGain.gain.exponentialRampToValueAtTime(
      AUDIO.ambient.synthesis.gullGain,
      now + AUDIO.ambient.synthesis.gullAttackSeconds,
    )
    synth.gullGain.gain.exponentialRampToValueAtTime(
      AUDIO.synthesis.silenceGain,
      now +
        AUDIO.ambient.synthesis.gullFallSeconds +
        AUDIO.ambient.synthesis.gullReleaseTailSeconds,
    )
    synth.nextGullTime =
      now +
      AUDIO.ambient.gullMinimumSeconds +
      nextSeededUnit(synth.musicState) *
        (AUDIO.ambient.gullMaximumSeconds - AUDIO.ambient.gullMinimumSeconds)
  }
  if (ambient.ropeCreak > 0 && now >= synth.nextCreakTime) {
    synth.creak.frequency.cancelScheduledValues(now)
    synth.creak.frequency.setValueAtTime(
      AUDIO.ambient.synthesis.creakStartHz,
      now,
    )
    synth.creak.frequency.exponentialRampToValueAtTime(
      AUDIO.ambient.synthesis.creakEndHz,
      now +
        AUDIO.ambient.synthesis.creakSeconds *
          AUDIO.ambient.synthesis.creakPeakFraction,
    )
    synth.creakGain.gain.cancelScheduledValues(now)
    synth.creakGain.gain.setValueAtTime(AUDIO.synthesis.silenceGain, now)
    synth.creakGain.gain.exponentialRampToValueAtTime(
      AUDIO.ambient.synthesis.creakGain,
      now + AUDIO.ambient.synthesis.creakAttackSeconds,
    )
    synth.creakGain.gain.exponentialRampToValueAtTime(
      AUDIO.synthesis.silenceGain,
      now + AUDIO.ambient.synthesis.creakSeconds,
    )
    synth.nextCreakTime =
      now +
      AUDIO.ambient.ropeCreakMinimumSeconds +
      nextSeededUnit(synth.musicState) *
        (AUDIO.ambient.ropeCreakMaximumSeconds -
          AUDIO.ambient.ropeCreakMinimumSeconds)
  }
  if (ambient.waystation > 0 && now >= synth.nextWoodTime) {
    synth.woodGain.gain.cancelScheduledValues(now)
    synth.woodGain.gain.setValueAtTime(AUDIO.ambient.synthesis.woodGain, now)
    synth.woodGain.gain.exponentialRampToValueAtTime(
      AUDIO.synthesis.silenceGain,
      now + AUDIO.ambient.synthesis.woodDurationSeconds,
    )
    synth.nextWoodTime =
      now +
      AUDIO.ambient.synthesis.woodMinimumSeconds +
      nextSeededUnit(synth.musicState) *
        (AUDIO.ambient.synthesis.woodMaximumSeconds -
          AUDIO.ambient.synthesis.woodMinimumSeconds)
  }
  target(
    synth.porticoGain.gain,
    portico.gain * AUDIO.portico.chordGain * ambientMultiplier,
    now,
  )
  target(synth.porticoFilter.frequency, portico.lowpassHz, now)
  for (let index = 0; index < synth.porticoOscillators.length; index += 1)
    target(
      synth.porticoOscillators[index].frequency,
      AUDIO.portico.chordFrequenciesHz[index] * portico.pitchRatio,
      now,
    )

  const titleGain = titleOpen ? AUDIO.music.titleGainMultiplier : 1
  target(
    synth.exploreGain.gain,
    AUDIO.music.exploreGain * musicMultiplier * titleGain,
    now,
    AUDIO.music.crossfadeSeconds / AUDIO.music.crossfadeTimeConstantDivisor,
  )
  target(
    synth.combatGain.gain,
    musicLayer === 'combat' ? AUDIO.music.combatGain * musicMultiplier : 0,
    now,
    AUDIO.music.crossfadeSeconds / AUDIO.music.crossfadeTimeConstantDivisor,
  )

  if (now >= synth.nextPhraseTime) {
    const notes =
      AUDIO.music.phraseNoteMinimum +
      Math.floor(
        nextSeededUnit(synth.musicState) *
          (AUDIO.music.phraseNoteMaximum - AUDIO.music.phraseNoteMinimum + 1),
      )
    const rests =
      AUDIO.music.restBeatMinimum +
      Math.floor(
        nextSeededUnit(synth.musicState) *
          (AUDIO.music.restBeatMaximum - AUDIO.music.restBeatMinimum + 1),
      )
    const beatSeconds = 60 / AUDIO.music.tempoBpm
    for (let noteIndex = 0; noteIndex < notes; noteIndex += 1) {
      const scaleIndex = Math.floor(
        nextSeededUnit(synth.musicState) *
          AUDIO.music.scaleFrequenciesHz.length,
      )
      const frequency = AUDIO.music.scaleFrequenciesHz[scaleIndex]
      const noteTime = now + noteIndex * beatSeconds
      synth.stringOne.frequency.setTargetAtTime(
        frequency * AUDIO.music.stringOctaveMultiplier,
        noteTime,
        AUDIO.music.phraseStringRampSeconds,
      )
      synth.stringTwo.frequency.setTargetAtTime(
        frequency * AUDIO.music.stringOctaveMultiplier,
        noteTime,
        AUDIO.music.phraseStringRampSeconds,
      )
      synth.flute.frequency.setTargetAtTime(
        frequency * AUDIO.music.fluteOctaveMultiplier,
        noteTime,
        AUDIO.music.phraseFluteRampSeconds,
      )
    }
    const phraseEnd = now + notes * beatSeconds
    synth.phraseGain.gain.cancelScheduledValues(now)
    synth.phraseGain.gain.setValueAtTime(AUDIO.synthesis.silenceGain, now)
    synth.phraseGain.gain.linearRampToValueAtTime(
      AUDIO.music.phraseGain,
      now + AUDIO.music.phraseAttackSeconds,
    )
    synth.phraseGain.gain.setValueAtTime(
      AUDIO.music.phraseGain,
      phraseEnd - AUDIO.music.phraseReleaseSeconds,
    )
    synth.phraseGain.gain.linearRampToValueAtTime(
      AUDIO.synthesis.silenceGain,
      phraseEnd,
    )
    synth.nextPhraseTime = phraseEnd + rests * beatSeconds
  }

  if (musicLayer === 'combat' && now >= synth.nextDrumTime) {
    synth.drum.frequency.cancelScheduledValues(now)
    synth.drum.frequency.setValueAtTime(AUDIO.music.drumStartHz, now)
    synth.drum.frequency.exponentialRampToValueAtTime(
      AUDIO.music.drumEndHz,
      now + AUDIO.music.drumDurationSeconds,
    )
    synth.drumNoiseGain.gain.cancelScheduledValues(now)
    synth.drumNoiseGain.gain.setValueAtTime(AUDIO.music.drumNoiseGain, now)
    synth.drumNoiseGain.gain.exponentialRampToValueAtTime(
      AUDIO.synthesis.silenceGain,
      now + AUDIO.music.drumNoiseDurationSeconds,
    )
    synth.nextDrumTime = now + 60 / AUDIO.music.tempoBpm
  }
}

export function setHeelstoneHiss(
  synth: ContinuousSynth,
  context: AudioContext,
  active: boolean,
): void {
  target(
    synth.passGain.gain,
    active ? AUDIO.synthesis.heelstoneHissGain : 0,
    context.currentTime,
    AUDIO.synthesis.heelstoneHissRampSeconds,
  )
}

export function disposeContinuousSynth(synth: ContinuousSynth): void {
  synth.noiseSource.stop()
  synth.gull.stop()
  synth.creak.stop()
  synth.wood.stop()
  synth.stringOne.stop()
  synth.stringTwo.stop()
  synth.flute.stop()
  synth.fluteVibrato.stop()
  synth.drum.stop()
  for (let index = 0; index < synth.porticoOscillators.length; index += 1)
    synth.porticoOscillators[index].stop()
}
