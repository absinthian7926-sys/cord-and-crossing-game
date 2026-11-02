import type { QualityLevel } from './zone'

export const SETTINGS = {
  storageKey: 'cord-and-crossing.settings.v1',
  version: 1,
  writeDebounceMilliseconds: 250,
  volume: {
    minimum: 0,
    maximum: 100,
    defaults: {
      master: 80,
      music: 50,
      sfx: 80,
      ambient: 60,
    },
  },
  mouseSensitivity: {
    minimum: 0.5,
    maximum: 2,
    default: 1,
  },
  quality: {
    default: 'Medium' as QualityLevel,
    fallback: {
      thresholdFps: 45,
      durationSeconds: 8,
      toastSeconds: 4,
    },
    dprByQuality: {
      Low: 1,
      Medium: [1, 1.5],
      High: [1, 2],
    },
  },
} as const

export type VolumeBus = keyof typeof SETTINGS.volume.defaults
