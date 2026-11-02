import { AUDIO } from '../../data/audio'
import { ZONE } from '../../data/zone'
import type { GameScene } from '../scenes/sceneRuntime'

export type AudioCueId =
  | 'cast-whistle'
  | 'cord-snap'
  | 'recall-rattle'
  | 'cord-cut'
  | 'portico-bell'
  | 'heelstone-hiss-start'
  | 'heelstone-hiss-stop'
  | 'heelstone-chime'
  | 'scene-change'
  | 'footstep'
  | 'landing'
  | 'hit-flesh'
  | 'hit-block'
  | 'player-hurt'
  | 'arrow-terrain'

export type PorticoProximity = {
  gain: number
  pitchRatio: number
  lowpassHz: number
}

export type AmbientMix = {
  wind: number
  surf: number
  gulls: number
  ropeCreak: number
  waystation: number
}

export type HitKind =
  'flesh' | 'strike3' | 'block' | 'hurt' | 'arrow' | 'guardBreak'

export type HitCueDecision = {
  primary: AudioCueId
  secondary: AudioCueId | null
  gain: number
  pitchSemitones: number
}

export type CrossingAudioResult = 'valid' | 'partial' | 'reversed' | 'side'

export type HeelstoneAudioTransition =
  'started' | 'completed' | 'interrupted' | 'cancelled'

const semitoneRatio = (semitones: number): number => 2 ** (semitones / 12)

export function createPorticoProximity(): PorticoProximity {
  return {
    gain: 0,
    pitchRatio: 1,
    lowpassHz: AUDIO.portico.minimumLowpassHz,
  }
}

export function resolvePorticoProximity(
  scene: GameScene,
  zoneScreenUnlocked: boolean,
  distanceMeters: number,
  output: PorticoProximity,
): PorticoProximity {
  const active = scene === 'hollow' || zoneScreenUnlocked
  const distance = Math.max(0, distanceMeters)
  const range =
    AUDIO.portico.silentDistanceMeters - AUDIO.portico.fullDistanceMeters
  const amount = active
    ? Math.min(
        1,
        Math.max(0, (AUDIO.portico.silentDistanceMeters - distance) / range),
      )
    : 0
  output.gain = amount
  output.pitchRatio = semitoneRatio(AUDIO.portico.pitchRiseSemitones * amount)
  output.lowpassHz =
    AUDIO.portico.minimumLowpassHz +
    (AUDIO.portico.maximumLowpassHz - AUDIO.portico.minimumLowpassHz) * amount
  return output
}

export function whistlePitchForSpeed(speedMetersPerSecond: number): number {
  const speed = Math.max(0, speedMetersPerSecond)
  const amount = Math.min(1, speed / AUDIO.cord.referenceSpeedMetersPerSecond)
  return (
    AUDIO.cord.whistleMinimumPitch +
    (AUDIO.cord.whistleMaximumPitch - AUDIO.cord.whistleMinimumPitch) * amount
  )
}

export function resolveCrossingCue(
  result: CrossingAudioResult,
): 'portico-bell' | null {
  return result === 'valid' ? 'portico-bell' : null
}

export function resolveHeelstoneCue(
  transition: HeelstoneAudioTransition,
): 'heelstone-hiss-start' | 'heelstone-hiss-stop' | 'heelstone-chime' {
  if (transition === 'started') return 'heelstone-hiss-start'
  if (transition === 'completed') return 'heelstone-chime'
  return 'heelstone-hiss-stop'
}

export function surfGainAtX(x: number): number {
  if (x <= AUDIO.ambient.zoneSurfFullX) return 1
  if (x >= AUDIO.ambient.zoneSurfMinimumX)
    return AUDIO.ambient.zoneSurfMinimumGain
  const amount =
    (x - AUDIO.ambient.zoneSurfFullX) /
    (AUDIO.ambient.zoneSurfMinimumX - AUDIO.ambient.zoneSurfFullX)
  return 1 + (AUDIO.ambient.zoneSurfMinimumGain - 1) * amount
}

export function createAmbientMix(): AmbientMix {
  return { wind: 0, surf: 0, gulls: 0, ropeCreak: 0, waystation: 0 }
}

export function isNearZoneRope(
  x: number,
  z: number,
  cliffPathDistance: number,
): boolean {
  if (cliffPathDistance <= AUDIO.ambient.ropeCreakRadius) return true
  const shelterX =
    ZONE.locations.A.center[0] + ZONE.placeholders.waystation.shelterCenter[0]
  const shelterZ =
    ZONE.locations.A.center[1] + ZONE.placeholders.waystation.shelterCenter[1]
  return Math.hypot(x - shelterX, z - shelterZ) <= AUDIO.ambient.ropeCreakRadius
}

export function resolveAmbientMix(
  scene: GameScene,
  x: number,
  nearRope: boolean,
  nearWaystation: boolean,
  output: AmbientMix,
): AmbientMix {
  if (scene === 'hollow') {
    output.wind = AUDIO.ambient.hollowWindGain
    output.surf = AUDIO.ambient.hollowSurfGain
    output.gulls = 0
    output.ropeCreak = nearRope ? 1 : 0
    output.waystation = 0
    return output
  }

  output.wind = AUDIO.ambient.zoneWindGain
  output.surf = surfGainAtX(x)
  output.gulls =
    Math.abs(x - AUDIO.ambient.gullCoastX) <= AUDIO.ambient.gullMaximumDistance
      ? 1
      : 0
  output.ropeCreak = nearRope ? 1 : 0
  output.waystation = nearWaystation ? 1 : 0
  return output
}

export function createHitCueDecision(): HitCueDecision {
  return {
    primary: 'hit-flesh',
    secondary: null,
    gain: 1,
    pitchSemitones: 0,
  }
}

export function resolveHitCue(
  kind: HitKind,
  output: HitCueDecision,
): HitCueDecision {
  output.secondary = null
  output.gain = 1
  output.pitchSemitones = 0

  if (kind === 'strike3') {
    output.primary = 'hit-flesh'
    output.gain = AUDIO.hits.strikeThreeGainMultiplier
  } else if (kind === 'block') output.primary = 'hit-block'
  else if (kind === 'hurt') output.primary = 'player-hurt'
  else if (kind === 'arrow') output.primary = 'arrow-terrain'
  else if (kind === 'guardBreak') {
    output.primary = 'hit-block'
    output.secondary = 'hit-flesh'
    output.pitchSemitones = AUDIO.hits.guardBreakPitchSemitones
  } else output.primary = 'hit-flesh'

  return output
}
