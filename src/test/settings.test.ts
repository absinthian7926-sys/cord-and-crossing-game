import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SETTINGS } from '../data/settings'
import {
  createDefaultSettings,
  deserializeSettings,
  mergeSettings,
  migrateSettings,
  serializeSettings,
  type SettingsData,
} from '../game/settings/settings'
import {
  createSettingsRuntime,
  loadSettingsFromStorage,
  saveSettingsToStorage,
  SETTINGS_LOAD_WARNING,
  SETTINGS_WRITE_WARNING,
  type SettingsStorage,
  type SettingsTimerHost,
} from '../game/settings/settingsRuntime'

function completeSettings(): SettingsData {
  return {
    settingsVersion: 1,
    volumes: { master: 72, music: 41, sfx: 63, ambient: 54 },
    quality: 'High',
    qualityChosenByHand: true,
    reduceMotion: true,
    reduceMotionSetByHand: true,
    mouseSensitivity: 1.4,
    invertY: true,
  }
}

function memoryStorage(initial: string | null = null): SettingsStorage & {
  value: string | null
} {
  return {
    value: initial,
    getItem() {
      return this.value
    },
    setItem(_key, value) {
      this.value = value
    },
  }
}

describe('settings data', () => {
  it('defines the requested defaults, ranges, storage key and debounce', () => {
    expect(SETTINGS).toEqual({
      storageKey: 'cord-and-crossing.settings.v1',
      version: 1,
      writeDebounceMilliseconds: 250,
      volume: {
        minimum: 0,
        maximum: 100,
        defaults: { master: 80, music: 50, sfx: 80, ambient: 60 },
      },
      mouseSensitivity: { minimum: 0.5, maximum: 2, default: 1 },
      quality: {
        default: 'Medium',
        fallback: { thresholdFps: 45, durationSeconds: 8, toastSeconds: 4 },
        dprByQuality: { Low: 1, Medium: [1, 1.5], High: [1, 2] },
      },
    })
  })
})

describe('settings validation and migration', () => {
  it('creates defaults using the system reduce-motion preference', () => {
    expect(createDefaultSettings(false)).toEqual({
      settingsVersion: 1,
      volumes: { master: 80, music: 50, sfx: 80, ambient: 60 },
      quality: 'Medium',
      qualityChosenByHand: false,
      reduceMotion: false,
      reduceMotionSetByHand: false,
      mouseSensitivity: 1,
      invertY: false,
    })
    expect(createDefaultSettings(true).reduceMotion).toBe(true)
  })

  it('merges partial version 1 data, clamps numbers and rejects wrong field types', () => {
    expect(
      mergeSettings(
        {
          settingsVersion: 1,
          volumes: {
            master: -1,
            music: 101,
            sfx: Number.NaN,
            ambient: 'loud',
          },
          quality: 'Ultra',
          qualityChosenByHand: 'yes',
          reduceMotion: true,
          reduceMotionSetByHand: true,
          mouseSensitivity: 3,
          invertY: true,
        },
        false,
      ),
    ).toEqual({
      settingsVersion: 1,
      volumes: { master: 0, music: 100, sfx: 80, ambient: 60 },
      quality: 'Medium',
      qualityChosenByHand: false,
      reduceMotion: true,
      reduceMotionSetByHand: true,
      mouseSensitivity: 2,
      invertY: true,
    })

    expect(mergeSettings({}, true)).toEqual(createDefaultSettings(true))
    expect(
      mergeSettings(
        {
          settingsVersion: 1,
          reduceMotion: false,
          reduceMotionSetByHand: false,
        },
        true,
      ).reduceMotion,
    ).toBe(true)
    expect(mergeSettings(null, true)).toEqual(createDefaultSettings(true))
    expect(mergeSettings([], true)).toEqual(createDefaultSettings(true))
  })

  it('migrates version 0 volume and accepts current partial data', () => {
    expect(migrateSettings({ settingsVersion: 0, volume: 0.7 }, false)).toEqual(
      {
        ...createDefaultSettings(false),
        volumes: { master: 70, music: 50, sfx: 80, ambient: 60 },
      },
    )
    expect(migrateSettings({ settingsVersion: 0, volume: -1 }, false)).toEqual({
      ...createDefaultSettings(false),
      volumes: { master: 0, music: 50, sfx: 80, ambient: 60 },
    })
    expect(migrateSettings({ settingsVersion: 0, volume: 2 }, false)).toEqual({
      ...createDefaultSettings(false),
      volumes: { master: 100, music: 50, sfx: 80, ambient: 60 },
    })
    expect(
      migrateSettings({ settingsVersion: 0, volume: 'loud' }, true),
    ).toEqual(createDefaultSettings(true))
    expect(
      migrateSettings({ settingsVersion: 1, quality: 'Low' }, false)?.quality,
    ).toBe('Low')
    expect(migrateSettings({ settingsVersion: 2 }, false)).toBeNull()
    expect(migrateSettings('bad', false)).toBeNull()
  })

  it('round-trips valid settings and reports fallback reasons', () => {
    const data = completeSettings()
    expect(deserializeSettings(serializeSettings(data), false)).toEqual({
      settings: data,
      usedFallback: false,
      reason: null,
    })
    expect(deserializeSettings(null, true)).toEqual({
      settings: createDefaultSettings(true),
      usedFallback: false,
      reason: 'missing',
    })
    expect(deserializeSettings('{', false).reason).toBe('corrupt')
    expect(deserializeSettings('null', false).reason).toBe('invalid')
    expect(deserializeSettings('{"settingsVersion":2}', false).reason).toBe(
      'newer-version',
    )
    expect(
      deserializeSettings('{"settingsVersion":0,"volume":0.7}', false),
    ).toEqual({
      settings: {
        ...createDefaultSettings(false),
        volumes: { master: 70, music: 50, sfx: 80, ambient: 60 },
      },
      usedFallback: false,
      reason: null,
    })
  })
})

describe('settings runtime persistence', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('loads missing data silently and warns once for invalid data', () => {
    const warn = vi.fn()
    expect(loadSettingsFromStorage(memoryStorage(), true, warn)).toEqual(
      createDefaultSettings(true),
    )
    expect(warn).not.toHaveBeenCalled()

    const invalid = memoryStorage('null')
    expect(loadSettingsFromStorage(invalid, false, warn)).toEqual(
      createDefaultSettings(false),
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(SETTINGS_LOAD_WARNING)
  })

  it('warns once when storage reads or writes throw', () => {
    const warn = vi.fn()
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('read')
      },
      setItem: () => {
        throw new Error('write')
      },
    }
    expect(loadSettingsFromStorage(broken, false, warn)).toEqual(
      createDefaultSettings(false),
    )
    expect(saveSettingsToStorage(broken, completeSettings(), warn)).toBe(false)
    expect(warn.mock.calls).toEqual([
      [SETTINGS_LOAD_WARNING],
      [SETTINGS_WRITE_WARNING],
    ])
  })

  it('writes valid settings and debounces runtime changes by 250 ms', () => {
    const storage = memoryStorage(serializeSettings(completeSettings()))
    const callbacks = new Map<number, () => void>()
    const cleared: number[] = []
    let nextId = 1
    const timer: SettingsTimerHost = {
      setTimeout(handler, milliseconds) {
        expect(milliseconds).toBe(250)
        const id = nextId
        nextId += 1
        callbacks.set(id, handler)
        return id
      },
      clearTimeout(id) {
        cleared.push(id)
        callbacks.delete(id)
      },
    }
    const runtime = createSettingsRuntime(storage, timer, false)
    expect(runtime.store.getState().quality).toBe('High')

    runtime.store.getState().setQuality('Low', true)
    runtime.store.getState().setVolume('music', 150)
    expect(cleared).toEqual([1])
    expect(storage.value).toBe(serializeSettings(completeSettings()))

    callbacks.get(2)?.()
    const saved = deserializeSettings(storage.value, false).settings
    expect(saved.quality).toBe('Low')
    expect(saved.qualityChosenByHand).toBe(true)
    expect(saved.volumes.music).toBe(100)

    runtime.store.getState().setReduceMotion(false, true)
    runtime.store.getState().setMouseSensitivity(0)
    runtime.store.getState().setInvertY(false)
    runtime.flush()
    expect(cleared).toContain(3)
    expect(runtime.store.getState()).toMatchObject({
      reduceMotion: false,
      reduceMotionSetByHand: true,
      mouseSensitivity: 0.5,
      invertY: false,
    })
    runtime.dispose()
  })

  it('saves directly and reports success', () => {
    const storage = memoryStorage()
    const data = completeSettings()
    expect(saveSettingsToStorage(storage, data)).toBe(true)
    expect(storage.value).toBe(serializeSettings(data))
  })
})
