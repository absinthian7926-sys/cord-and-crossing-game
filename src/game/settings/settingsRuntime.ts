import { createStore, type StoreApi } from 'zustand/vanilla'
import { SETTINGS, type VolumeBus } from '../../data/settings'
import type { QualityLevel } from '../../data/zone'
import {
  createDefaultSettings,
  deserializeSettings,
  serializeSettings,
  type SettingsData,
} from './settings'

export const SETTINGS_LOAD_WARNING =
  'Cord and Crossing settings could not be loaded. Using defaults.'
export const SETTINGS_WRITE_WARNING =
  'Cord and Crossing settings could not be written.'

export type SettingsStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type SettingsTimerHost = {
  setTimeout(handler: () => void, milliseconds: number): number
  clearTimeout(id: number): void
}

export type SettingsRuntimeState = SettingsData & {
  setQuality(quality: QualityLevel, chosenByHand?: boolean): void
  setVolume(bus: VolumeBus, value: number): void
  setReduceMotion(value: boolean, chosenByHand?: boolean): void
  setMouseSensitivity(value: number): void
  setInvertY(value: boolean): void
}

export type SettingsRuntime = {
  store: StoreApi<SettingsRuntimeState>
  flush(): void
  dispose(): void
}

type SettingsWarning = (message: string) => void

let activeRuntime: SettingsRuntime | null = null

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function loadSettingsFromStorage(
  storage: SettingsStorage,
  prefersReducedMotion: boolean,
  warn: SettingsWarning = console.warn,
): SettingsData {
  let serialized: string | null
  try {
    serialized = storage.getItem(SETTINGS.storageKey)
  } catch {
    warn(SETTINGS_LOAD_WARNING)
    return createDefaultSettings(prefersReducedMotion)
  }
  const result = deserializeSettings(serialized, prefersReducedMotion)
  if (result.usedFallback) warn(SETTINGS_LOAD_WARNING)
  return result.settings
}

export function saveSettingsToStorage(
  storage: SettingsStorage,
  settings: SettingsData,
  warn: SettingsWarning = console.warn,
): boolean {
  try {
    storage.setItem(SETTINGS.storageKey, serializeSettings(settings))
    return true
  } catch {
    warn(SETTINGS_WRITE_WARNING)
    return false
  }
}

function snapshotSettings(state: SettingsRuntimeState): SettingsData {
  return {
    settingsVersion: SETTINGS.version,
    volumes: { ...state.volumes },
    quality: state.quality,
    qualityChosenByHand: state.qualityChosenByHand,
    reduceMotion: state.reduceMotion,
    reduceMotionSetByHand: state.reduceMotionSetByHand,
    mouseSensitivity: state.mouseSensitivity,
    invertY: state.invertY,
  }
}

export function createSettingsRuntime(
  storage: SettingsStorage,
  timer: SettingsTimerHost,
  prefersReducedMotion: boolean,
  warn: SettingsWarning = console.warn,
): SettingsRuntime {
  const initial = loadSettingsFromStorage(storage, prefersReducedMotion, warn)
  const store = createStore<SettingsRuntimeState>((set) => ({
    ...initial,
    volumes: { ...initial.volumes },
    setQuality: (quality, chosenByHand = false) =>
      set({
        quality,
        qualityChosenByHand:
          chosenByHand || store.getState().qualityChosenByHand,
      }),
    setVolume: (bus, value) =>
      set((state) => ({
        volumes: {
          ...state.volumes,
          [bus]: clamp(value, SETTINGS.volume.minimum, SETTINGS.volume.maximum),
        },
      })),
    setReduceMotion: (value, chosenByHand = false) =>
      set({
        reduceMotion: value,
        reduceMotionSetByHand:
          chosenByHand || store.getState().reduceMotionSetByHand,
      }),
    setMouseSensitivity: (value) =>
      set({
        mouseSensitivity: clamp(
          value,
          SETTINGS.mouseSensitivity.minimum,
          SETTINGS.mouseSensitivity.maximum,
        ),
      }),
    setInvertY: (value) => set({ invertY: value }),
  }))

  let pendingId: number | null = null
  const persist = () => {
    pendingId = null
    saveSettingsToStorage(storage, snapshotSettings(store.getState()), warn)
  }
  const unsubscribe = store.subscribe(() => {
    if (pendingId !== null) timer.clearTimeout(pendingId)
    pendingId = timer.setTimeout(persist, SETTINGS.writeDebounceMilliseconds)
  })

  return {
    store,
    flush() {
      if (pendingId === null) return
      timer.clearTimeout(pendingId)
      persist()
    },
    dispose() {
      unsubscribe()
      if (pendingId !== null) timer.clearTimeout(pendingId)
      pendingId = null
    },
  }
}

export function initializeSettingsRuntime(
  storage: SettingsStorage,
  timer: SettingsTimerHost,
  prefersReducedMotion: boolean,
  warn: SettingsWarning = console.warn,
): SettingsRuntime {
  if (activeRuntime === null) {
    activeRuntime = createSettingsRuntime(
      storage,
      timer,
      prefersReducedMotion,
      warn,
    )
  }
  return activeRuntime
}

export function getSettingsRuntime(): SettingsRuntime {
  if (activeRuntime === null) {
    throw new Error('Settings runtime has not been initialized.')
  }
  return activeRuntime
}

export function getSettingsRuntimeSnapshot(): SettingsRuntimeState {
  return getSettingsRuntime().store.getState()
}

export function subscribeSettingsRuntime(listener: () => void): () => void {
  return getSettingsRuntime().store.subscribe(listener)
}

export function disposeSettingsRuntime(): void {
  if (activeRuntime === null) return
  activeRuntime.flush()
  activeRuntime.dispose()
  activeRuntime = null
}
