import type { AudioEngineSnapshot } from './audio'

type AudioModule = typeof import('./audio')

let audioModule: AudioModule | null = null
let loading: Promise<AudioModule> | null = null

const unloadedSnapshot: AudioEngineSnapshot = {
  loaded: false,
  contextState: 'not-loaded',
  activeVoiceCount: 0,
  masterGain: 0,
  musicGain: 0,
  sfxGain: 0,
  ambientGain: 0,
  musicLayer: 'explore',
  lastCueIds: [],
  lastFootstepSurface: null,
  lastFootstepSequence: 0,
}

export async function loadAndStartAudioEngine(): Promise<void> {
  if (audioModule === null) {
    loading ??= import('./audio')
    audioModule = await loading
  }
  await audioModule.startAudioEngine()
}

export function getLazyAudioSnapshot(): AudioEngineSnapshot {
  return audioModule?.getAudioEngineSnapshot() ?? unloadedSnapshot
}

export async function disposeLazyAudioEngine(): Promise<void> {
  if (audioModule !== null) await audioModule.disposeAudioEngine()
  audioModule = null
  loading = null
}
