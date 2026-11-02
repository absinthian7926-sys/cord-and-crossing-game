import { AUDIO } from '../../data/audio'
import { ZONE } from '../../data/zone'
import { enemyRuntime } from '../enemies/enemyRuntime'
import { getPauseRuntimeSnapshot } from '../pause/pauseRuntime'
import { playerStore } from '../player/playerStore'
import { getPorticoRuntimeSnapshot } from '../portico/porticoRuntime'
import { getSceneRuntimeSnapshot } from '../scenes/sceneRuntime'
import { getSettingsRuntimeSnapshot } from '../settings/settingsRuntime'
import { distanceToCliffPath } from '../world/road'
import {
  createAmbientMix,
  createPorticoProximity,
  resolveAmbientMix,
  resolvePorticoProximity,
} from './audioCues'
import {
  audioBus,
  createAudioEvent,
  readAudioEvent,
  type AudioEvent,
} from './audioBus'
import {
  createMixerFrame,
  resolveMixerFrame,
  sliderToGain,
  startMusicDuck,
  stepMusicDuck,
} from './mixer'
import {
  createMusicDirectorState,
  stepMusicDirector,
  type MusicLayer,
} from './musicDirector'
import {
  createContinuousSynth,
  disposeContinuousSynth,
  setHeelstoneHiss,
  updateContinuousSynth,
  type ContinuousSynth,
} from './synth/continuous'
import { createNoiseBuffer } from './synth/noise'
import {
  countActiveSfxVoices,
  createSfxVoicePool,
  disposeSfxVoicePool,
  playSfxEvent,
  type SfxVoicePool,
} from './synth/voicePool'

export type AudioEngineSnapshot = {
  loaded: boolean
  contextState: AudioContextState | 'not-loaded'
  activeVoiceCount: number
  masterGain: number
  musicGain: number
  sfxGain: number
  ambientGain: number
  musicLayer: MusicLayer
  lastCueIds: string[]
}

type AudioEngine = {
  readonly context: AudioContext
  readonly masterGain: GainNode
  readonly musicGain: GainNode
  readonly sfxGain: GainNode
  readonly ambientGain: GainNode
  readonly musicFilter: BiquadFilterNode
  readonly ambientFilter: BiquadFilterNode
  readonly voicePool: SfxVoicePool
  readonly continuous: ContinuousSynth
  readonly noiseBuffer: AudioBuffer
  readonly event: AudioEvent
  animationFrame: number
  lastFrameSeconds: number
  duckRemainingSeconds: number
  disposed: boolean
}

const ambientMix = createAmbientMix()
const porticoProximity = createPorticoProximity()
const mixerFrame = createMixerFrame()
const musicDirector = createMusicDirectorState()
const cueHistory = new Array<string>(AUDIO.engine.cueHistoryCapacity).fill('')
let cueHistoryIndex = 0
let cueHistoryCount = 0
let engine: AudioEngine | null = null

const runtimeSnapshot: AudioEngineSnapshot = {
  loaded: false,
  contextState: 'not-loaded',
  activeVoiceCount: 0,
  masterGain: 0,
  musicGain: 0,
  sfxGain: 0,
  ambientGain: 0,
  musicLayer: 'explore',
  lastCueIds: [],
}

function recordCue(id: string): void {
  cueHistory[cueHistoryIndex] = id
  cueHistoryIndex = (cueHistoryIndex + 1) % cueHistory.length
  cueHistoryCount = Math.min(cueHistoryCount + 1, cueHistory.length)
}

function configureGraph(context: AudioContext): AudioEngine {
  const masterGain = context.createGain()
  const musicGain = context.createGain()
  const sfxGain = context.createGain()
  const ambientGain = context.createGain()
  const musicFilter = context.createBiquadFilter()
  const ambientFilter = context.createBiquadFilter()
  const compressor = context.createDynamicsCompressor()
  compressor.threshold.value = AUDIO.buses.compressor.thresholdDb
  compressor.ratio.value = AUDIO.buses.compressor.ratio
  musicFilter.type = 'lowpass'
  ambientFilter.type = 'lowpass'
  musicFilter.frequency.value = AUDIO.buses.openLowpassHz
  ambientFilter.frequency.value = AUDIO.buses.openLowpassHz
  musicFilter.connect(musicGain).connect(masterGain)
  ambientFilter.connect(ambientGain).connect(masterGain)
  sfxGain.connect(masterGain)
  masterGain.connect(compressor).connect(context.destination)

  const noiseBuffer = createNoiseBuffer(
    context,
    AUDIO.engine.noiseBufferSeconds,
    AUDIO.music.seed,
  )
  const voicePool = createSfxVoicePool(context, sfxGain)
  const continuous = createContinuousSynth(
    context,
    ambientFilter,
    musicFilter,
    noiseBuffer,
  )
  return {
    context,
    masterGain,
    musicGain,
    sfxGain,
    ambientGain,
    musicFilter,
    ambientFilter,
    voicePool,
    continuous,
    noiseBuffer,
    event: createAudioEvent(),
    animationFrame: 0,
    lastFrameSeconds: performance.now() / 1_000,
    duckRemainingSeconds: 0,
    disposed: false,
  }
}

function enemyInCombat(): boolean {
  const records = enemyRuntime.records
  for (let index = 0; index < records.length; index += 1) {
    const enemy = records[index]
    if (
      enemy.phase === 'Alive' &&
      (enemy.state === 'Chase' || enemy.state === 'Attack')
    )
      return true
  }
  return false
}

function nearHollowRope(x: number, z: number): boolean {
  const practiceDistance = Math.hypot(
    x - ZONE.hollow.practiceRail[0],
    z - ZONE.hollow.practiceRail[1],
  )
  if (practiceDistance <= AUDIO.ambient.ropeCreakRadius) return true
  return (
    Math.hypot(x - ZONE.hollow.snagPost[0], z - ZONE.hollow.snagPost[1]) <=
    AUDIO.ambient.ropeCreakRadius
  )
}

function handleEvent(
  current: AudioEngine,
  event: AudioEvent,
  paused: boolean,
): void {
  if (event.id === 'heelstone-hiss-start') {
    if (!paused) {
      setHeelstoneHiss(current.continuous, current.context, true)
      recordCue(event.id)
    }
    return
  }
  if (event.id === 'heelstone-hiss-stop') {
    setHeelstoneHiss(current.continuous, current.context, false)
    recordCue(event.id)
    return
  }
  if (event.id === 'heelstone-chime')
    setHeelstoneHiss(current.continuous, current.context, false)
  if (paused || event.id === 'scene-change') return
  if (event.id === 'portico-bell')
    current.duckRemainingSeconds = startMusicDuck()
  if (playSfxEvent(current.voicePool, event, current.noiseBuffer))
    recordCue(event.id)
}

function update(current: AudioEngine, frameSeconds: number): void {
  const deltaSeconds = Math.min(
    AUDIO.engine.maximumFrameDeltaSeconds,
    Math.max(0, frameSeconds - current.lastFrameSeconds),
  )
  current.lastFrameSeconds = frameSeconds
  const pause = getPauseRuntimeSnapshot()
  const paused = pause.open
  const settings = getSettingsRuntimeSnapshot()
  current.duckRemainingSeconds = stepMusicDuck(
    current.duckRemainingSeconds,
    paused ? 0 : deltaSeconds,
  )
  resolveMixerFrame(paused, current.duckRemainingSeconds, mixerFrame)
  const now = current.context.currentTime
  const ramp = AUDIO.buses.pause.rampSeconds
  const master = sliderToGain(settings.volumes.master)
  const music = sliderToGain(settings.volumes.music)
  const sfx = sliderToGain(settings.volumes.sfx)
  const ambient = sliderToGain(settings.volumes.ambient)
  current.masterGain.gain.setTargetAtTime(
    master,
    now,
    AUDIO.engine.busRampSeconds,
  )
  current.musicGain.gain.setTargetAtTime(music, now, ramp)
  current.sfxGain.gain.setTargetAtTime(sfx, now, AUDIO.engine.busRampSeconds)
  current.ambientGain.gain.setTargetAtTime(ambient, now, ramp)
  current.musicFilter.frequency.setTargetAtTime(
    mixerFrame.musicLowpassHz,
    now,
    ramp,
  )
  current.ambientFilter.frequency.setTargetAtTime(
    mixerFrame.ambientLowpassHz,
    now,
    ramp,
  )

  while (readAudioEvent(audioBus, current.event) !== null)
    handleEvent(current, current.event, paused || !mixerFrame.allowNewSfx)

  const player = playerStore.getState().position
  const scene = getSceneRuntimeSnapshot().currentScene
  const nearRope =
    scene === 'hollow'
      ? nearHollowRope(player.x, player.z)
      : distanceToCliffPath(player.x, player.z) <= AUDIO.ambient.ropeCreakRadius
  const nearWaystation =
    scene === 'zone' &&
    Math.hypot(player.x, player.z) <= AUDIO.ambient.waystationRadius
  resolveAmbientMix(scene, player.x, nearRope, nearWaystation, ambientMix)

  const screenX =
    scene === 'hollow' ? ZONE.hollow.porticoCenter[0] : ZONE.portico.center[0]
  const screenZ =
    scene === 'hollow' ? ZONE.hollow.porticoCenter[1] : ZONE.portico.center[1]
  const screenDistance = Math.hypot(player.x - screenX, player.z - screenZ)
  resolvePorticoProximity(
    scene,
    getPorticoRuntimeSnapshot().phase === 'active',
    screenDistance,
    porticoProximity,
  )
  stepMusicDirector(musicDirector, enemyInCombat(), paused, deltaSeconds)
  updateContinuousSynth(
    current.continuous,
    current.context,
    ambientMix,
    porticoProximity,
    musicDirector.layer,
    mixerFrame.musicGainMultiplier,
    mixerFrame.ambientGainMultiplier,
    pause.titleOpen,
  )

  runtimeSnapshot.loaded = true
  runtimeSnapshot.contextState = current.context.state
  runtimeSnapshot.activeVoiceCount = countActiveSfxVoices(current.voicePool)
  runtimeSnapshot.masterGain = master
  runtimeSnapshot.musicGain = music * mixerFrame.musicGainMultiplier
  runtimeSnapshot.sfxGain = sfx
  runtimeSnapshot.ambientGain = ambient * mixerFrame.ambientGainMultiplier
  runtimeSnapshot.musicLayer = musicDirector.layer
}

function tick(timestampMilliseconds: number): void {
  const current = engine
  if (current === null || current.disposed) return
  update(current, timestampMilliseconds / 1_000)
  current.animationFrame = window.requestAnimationFrame(tick)
}

function visibilityChanged(): void {
  const current = engine
  if (current === null) return
  const action = document.hidden
    ? current.context.suspend()
    : current.context.resume()
  void action
    .then(() => {
      runtimeSnapshot.contextState = current.context.state
    })
    .catch(() => undefined)
}

export async function startAudioEngine(): Promise<void> {
  if (engine === null) {
    engine = configureGraph(new AudioContext())
    document.addEventListener('visibilitychange', visibilityChanged)
    engine.animationFrame = window.requestAnimationFrame(tick)
  }
  if (engine.context.state === 'suspended') await engine.context.resume()
  runtimeSnapshot.loaded = true
  runtimeSnapshot.contextState = engine.context.state
}

export async function disposeAudioEngine(): Promise<void> {
  const current = engine
  if (current === null) return
  current.disposed = true
  window.cancelAnimationFrame(current.animationFrame)
  document.removeEventListener('visibilitychange', visibilityChanged)
  disposeSfxVoicePool(current.voicePool)
  disposeContinuousSynth(current.continuous)
  await current.context.close()
  engine = null
  runtimeSnapshot.loaded = false
  runtimeSnapshot.contextState = 'not-loaded'
  runtimeSnapshot.activeVoiceCount = 0
}

export function getAudioEngineSnapshot(): AudioEngineSnapshot {
  const history = new Array<string>(cueHistoryCount)
  const start =
    (cueHistoryIndex - cueHistoryCount + cueHistory.length) % cueHistory.length
  for (let index = 0; index < cueHistoryCount; index += 1)
    history[index] = cueHistory[(start + index) % cueHistory.length]
  return {
    loaded: runtimeSnapshot.loaded,
    contextState: runtimeSnapshot.contextState,
    activeVoiceCount: runtimeSnapshot.activeVoiceCount,
    masterGain: runtimeSnapshot.masterGain,
    musicGain: runtimeSnapshot.musicGain,
    sfxGain: runtimeSnapshot.sfxGain,
    ambientGain: runtimeSnapshot.ambientGain,
    musicLayer: runtimeSnapshot.musicLayer,
    lastCueIds: history,
  }
}
