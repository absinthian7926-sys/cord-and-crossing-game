import { SETTINGS, type VolumeBus } from '../../data/settings'
import { QUALITY_LEVELS, type QualityLevel } from '../../data/zone'

export type SettingsVolumes = Record<VolumeBus, number>

export type SettingsData = {
  settingsVersion: 1
  volumes: SettingsVolumes
  quality: QualityLevel
  qualityChosenByHand: boolean
  reduceMotion: boolean
  reduceMotionSetByHand: boolean
  mouseSensitivity: number
  invertY: boolean
}

export type SettingsFallbackReason =
  'missing' | 'corrupt' | 'invalid' | 'newer-version'

export type SettingsLoadResult = {
  settings: SettingsData
  usedFallback: boolean
  reason: SettingsFallbackReason | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function clampedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return clamp(finiteNumber(value, fallback), minimum, maximum)
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function qualityOr(value: unknown, fallback: QualityLevel): QualityLevel {
  return typeof value === 'string' &&
    QUALITY_LEVELS.includes(value as QualityLevel)
    ? (value as QualityLevel)
    : fallback
}

export function createDefaultSettings(
  prefersReducedMotion: boolean,
): SettingsData {
  return {
    settingsVersion: SETTINGS.version,
    volumes: { ...SETTINGS.volume.defaults },
    quality: SETTINGS.quality.default,
    qualityChosenByHand: false,
    reduceMotion: prefersReducedMotion,
    reduceMotionSetByHand: false,
    mouseSensitivity: SETTINGS.mouseSensitivity.default,
    invertY: false,
  }
}

export function mergeSettings(
  value: unknown,
  prefersReducedMotion: boolean,
): SettingsData {
  const defaults = createDefaultSettings(prefersReducedMotion)
  if (!isRecord(value)) return defaults
  const volumeSource = isRecord(value.volumes) ? value.volumes : {}
  const reduceMotionSetByHand = booleanOr(
    value.reduceMotionSetByHand,
    defaults.reduceMotionSetByHand,
  )
  return {
    settingsVersion: SETTINGS.version,
    volumes: {
      master: clampedNumber(
        volumeSource.master,
        defaults.volumes.master,
        SETTINGS.volume.minimum,
        SETTINGS.volume.maximum,
      ),
      music: clampedNumber(
        volumeSource.music,
        defaults.volumes.music,
        SETTINGS.volume.minimum,
        SETTINGS.volume.maximum,
      ),
      sfx: clampedNumber(
        volumeSource.sfx,
        defaults.volumes.sfx,
        SETTINGS.volume.minimum,
        SETTINGS.volume.maximum,
      ),
      ambient: clampedNumber(
        volumeSource.ambient,
        defaults.volumes.ambient,
        SETTINGS.volume.minimum,
        SETTINGS.volume.maximum,
      ),
    },
    quality: qualityOr(value.quality, defaults.quality),
    qualityChosenByHand: booleanOr(
      value.qualityChosenByHand,
      defaults.qualityChosenByHand,
    ),
    reduceMotion: reduceMotionSetByHand
      ? booleanOr(value.reduceMotion, defaults.reduceMotion)
      : prefersReducedMotion,
    reduceMotionSetByHand,
    mouseSensitivity: clampedNumber(
      value.mouseSensitivity,
      defaults.mouseSensitivity,
      SETTINGS.mouseSensitivity.minimum,
      SETTINGS.mouseSensitivity.maximum,
    ),
    invertY: booleanOr(value.invertY, defaults.invertY),
  }
}

function migrateVersionZero(
  value: Record<string, unknown>,
  prefersReducedMotion: boolean,
): SettingsData {
  const defaults = createDefaultSettings(prefersReducedMotion)
  const legacyVolume = clampedNumber(value.volume, 0.8, 0, 1) * 100
  return {
    ...defaults,
    volumes: { ...defaults.volumes, master: legacyVolume },
  }
}

export function migrateSettings(
  value: unknown,
  prefersReducedMotion: boolean,
): SettingsData | null {
  if (!isRecord(value)) return null
  if (value.settingsVersion === 0) {
    return migrateVersionZero(value, prefersReducedMotion)
  }
  if (value.settingsVersion === SETTINGS.version) {
    return mergeSettings(value, prefersReducedMotion)
  }
  return null
}

export function serializeSettings(settings: SettingsData): string {
  return JSON.stringify(settings)
}

export function deserializeSettings(
  serialized: string | null,
  prefersReducedMotion: boolean,
): SettingsLoadResult {
  if (serialized === null) {
    return {
      settings: createDefaultSettings(prefersReducedMotion),
      usedFallback: false,
      reason: 'missing',
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return {
      settings: createDefaultSettings(prefersReducedMotion),
      usedFallback: true,
      reason: 'corrupt',
    }
  }

  if (
    isRecord(parsed) &&
    typeof parsed.settingsVersion === 'number' &&
    parsed.settingsVersion > SETTINGS.version
  ) {
    return {
      settings: createDefaultSettings(prefersReducedMotion),
      usedFallback: true,
      reason: 'newer-version',
    }
  }

  const migrated = migrateSettings(parsed, prefersReducedMotion)
  if (migrated === null) {
    return {
      settings: createDefaultSettings(prefersReducedMotion),
      usedFallback: true,
      reason: 'invalid',
    }
  }
  return { settings: migrated, usedFallback: false, reason: null }
}
