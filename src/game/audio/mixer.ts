import { AUDIO } from '../../data/audio'

export const BUS_GRAPH = {
  master: ['music', 'sfx', 'ambient'],
  compressor: AUDIO.buses.compressor,
} as const

export type MixerFrame = {
  musicGainMultiplier: number
  ambientGainMultiplier: number
  musicLowpassHz: number
  ambientLowpassHz: number
  allowNewSfx: boolean
}

export function decibelsToGain(decibels: number): number {
  return 10 ** (decibels / 20)
}

export function sliderToGain(value: number): number {
  const finite = Number.isFinite(value) ? value : 0
  const normalized = Math.min(100, Math.max(0, finite)) / 100
  return normalized * normalized
}

export function createMixerFrame(): MixerFrame {
  return {
    musicGainMultiplier: 1,
    ambientGainMultiplier: 1,
    musicLowpassHz: AUDIO.buses.openLowpassHz,
    ambientLowpassHz: AUDIO.buses.openLowpassHz,
    allowNewSfx: true,
  }
}

export function startMusicDuck(): number {
  return AUDIO.buses.duck.durationSeconds
}

export function stepMusicDuck(
  remainingSeconds: number,
  deltaSeconds: number,
): number {
  return Math.max(0, remainingSeconds - Math.max(0, deltaSeconds))
}

export function resolveMixerFrame(
  paused: boolean,
  musicDuckRemainingSeconds: number,
  output: MixerFrame,
): MixerFrame {
  const duckDecibels =
    musicDuckRemainingSeconds > 0 ? AUDIO.buses.duck.decibels : 0
  const pauseDecibels = paused ? AUDIO.buses.pause.decibels : 0
  output.musicGainMultiplier = decibelsToGain(duckDecibels + pauseDecibels)
  output.ambientGainMultiplier = decibelsToGain(pauseDecibels)
  output.musicLowpassHz = paused
    ? AUDIO.buses.pause.lowpassHz
    : AUDIO.buses.openLowpassHz
  output.ambientLowpassHz = output.musicLowpassHz
  output.allowNewSfx = !paused
  return output
}
