import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAYER } from '../data/player'
import { SAVE_CONFIG } from '../data/quests'
import {
  advancePausableClock,
  resetPauseRuntime,
  setPauseOpen,
} from '../game/pause/pauseRuntime'
import { playerStore } from '../game/player/playerStore'
import {
  emitQuestEvent,
  getQuestRuntimeSnapshot,
  lootFrameShelterKey,
  markCampLeaderDefeated,
  resetQuestRuntime,
  setHollenNearby,
  setKeyNearbyTransient,
} from '../game/quest/questRuntime'
import {
  applyRuntimeSaveData,
  clearRuntimeSave,
  configureSaveWorldRuntimeAdapter,
  createRuntimeSaveData,
  installRuntimeAutosave,
  loadRuntimeSave,
  type AutosaveHost,
  type SaveWorldRuntimeAdapter,
  type SaveWorldRuntimeState,
} from '../game/save/saveRuntime'
import {
  createNewSaveData,
  serializeSave,
  type SaveStorage,
  type SaveWorldState,
} from '../game/save/save'
import { weaponRuntime } from '../game/weapons/weaponRuntime'

function memoryStorage(entries: Record<string, string> = {}): SaveStorage & {
  entries: Map<string, string>
} {
  const values = new Map(Object.entries(entries))
  return {
    entries: values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

function testWorldAdapter(initial?: Partial<SaveWorldRuntimeState>): {
  adapter: SaveWorldRuntimeAdapter
  state: () => SaveWorldRuntimeState
  notify: () => void
  hydrate: ReturnType<typeof vi.fn<(value: SaveWorldState) => void>>
} {
  let state: SaveWorldRuntimeState = {
    porticoUnlocked: false,
    currentScene: 'zone',
    hollow: {
      heelstonePassDone: false,
      snagPulled: false,
      encounterDefeated: false,
    },
    ...initial,
  }
  const listeners = new Set<() => void>()
  const hydrate = vi.fn((value: SaveWorldState) => {
    state = {
      porticoUnlocked: value.porticoUnlocked,
      currentScene: value.currentScene,
      hollow: { ...value.hollow },
    }
  })
  return {
    adapter: {
      getState: () => state,
      hydrate,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    state: () => state,
    notify: () => {
      for (const listener of listeners) listener()
    },
    hydrate,
  }
}

describe('save runtime', () => {
  beforeEach(() => {
    resetPauseRuntime()
    configureSaveWorldRuntimeAdapter(null)
    resetQuestRuntime()
    const player = playerStore.getState()
    player.position.x = 0
    player.position.y = 8 + PLAYER.collider.halfHeight + PLAYER.collider.radius
    player.position.z = 0
    player.teleportTarget = null
    player.vitals.health = PLAYER.health.max
    player.vitals.stamina = PLAYER.stamina.max
    player.death.phase = 'Alive'
  })

  it('stores exact key drop, player state, and adapter world state', () => {
    const world = testWorldAdapter({
      porticoUnlocked: true,
      currentScene: 'hollow',
      hollow: {
        heelstonePassDone: true,
        snagPulled: true,
        encounterDefeated: false,
      },
    })
    configureSaveWorldRuntimeAdapter(world.adapter)
    const player = playerStore.getState()
    player.position.x = 12
    player.position.y = 10 + PLAYER.collider.halfHeight + PLAYER.collider.radius
    player.position.z = -4
    player.vitals.health = 72
    player.vitals.stamina = 48
    emitQuestEvent('talkedToHollen')
    markCampLeaderDefeated({ x: 381.25, y: 38.5, z: -235.75 })

    const save = createRuntimeSaveData()
    expect(save).toMatchObject({
      player: {
        health: 72,
        stamina: 48,
        position: { x: 12, z: -4 },
        cordState: 'InHand',
      },
      quest: {
        currentStep: 2,
        campLeaderDefeated: true,
        keyDrop: { x: 381.25, y: 38.5, z: -235.75 },
      },
      world: {
        porticoUnlocked: true,
        currentScene: 'hollow',
        hollow: { heelstonePassDone: true, snagPulled: true },
      },
    })
    expect(save.player.position.y).toBeCloseTo(10)
  })

  it('restores exact key drop, world state, vitals, position, and cord In Hand', () => {
    const world = testWorldAdapter()
    configureSaveWorldRuntimeAdapter(world.adapter)
    const data = createNewSaveData()
    data.player.health = 65
    data.player.stamina = 31
    data.player.position = { x: 10, y: 9, z: -5 }
    data.quest.currentStep = 2
    data.quest.completedSteps = [1]
    data.quest.campLeaderDefeated = true
    data.quest.keyDrop = { x: 381.25, y: 38.5, z: -235.75 }
    weaponRuntime.cord = {
      mode: 'Out',
      castKind: 'straight',
      retieRemaining: 0,
    }

    applyRuntimeSaveData(data, () => 8)
    const player = playerStore.getState()
    expect(player.vitals.health).toBe(65)
    expect(player.vitals.stamina).toBe(31)
    expect(player.teleportTarget).toMatchObject({ x: 10, z: -5 })
    expect(player.teleportTarget?.y).toBeCloseTo(
      9 + PLAYER.collider.halfHeight + PLAYER.collider.radius,
    )
    expect(getQuestRuntimeSnapshot().keyDrop).toEqual({
      x: 381.25,
      y: 38.5,
      z: -235.75,
    })
    expect(world.hydrate).toHaveBeenCalledWith(data.world)
    expect(weaponRuntime.cord.mode).toBe('InHand')

    data.player.health = 0
    applyRuntimeSaveData(data, () => 8)
    expect(player.vitals.health).toBe(PLAYER.health.max)
  })

  it('restores a non-default pending drop across reload and removes it after pickup', () => {
    emitQuestEvent('talkedToHollen')
    markCampLeaderDefeated({ x: 377.43, y: 40.12, z: -238.91 })
    const storage = memoryStorage()
    storage.setItem(
      SAVE_CONFIG.storageKey,
      serializeSave(createRuntimeSaveData()),
    )

    resetQuestRuntime()
    loadRuntimeSave(storage, () => 8)
    expect(getQuestRuntimeSnapshot().keyDrop).toEqual({
      x: 377.43,
      y: 40.12,
      z: -238.91,
    })
    setKeyNearbyTransient(true)
    expect(lootFrameShelterKey()).toBe(true)
    const afterPickup = createRuntimeSaveData()
    expect(afterPickup.quest.keyDrop).toBeNull()
    storage.setItem(SAVE_CONFIG.storageKey, serializeSave(afterPickup))

    resetQuestRuntime()
    loadRuntimeSave(storage, () => 8)
    expect(getQuestRuntimeSnapshot().quest.keyLooted).toBe(true)
    expect(getQuestRuntimeSnapshot().keyDrop).toBeNull()
  })

  it('loads and clears both storage versions without browser globals', () => {
    const storage = memoryStorage({
      [SAVE_CONFIG.storageKey]: JSON.stringify(createNewSaveData()),
      [SAVE_CONFIG.legacyStorageKey]: 'legacy',
    })
    expect(loadRuntimeSave(storage, () => 8).schemaVersion).toBe(2)
    clearRuntimeSave(storage, () => 8)
    expect(storage.entries.size).toBe(0)
    expect(getQuestRuntimeSnapshot().quest.currentStep).toBe(1)
  })

  it('autosaves persistent quest and world changes, alive intervals, and page hide', () => {
    const world = testWorldAdapter()
    configureSaveWorldRuntimeAdapter(world.adapter)
    const storage = memoryStorage()
    let interval: (() => void) | null = null
    let pageHide: (() => void) | null = null
    const host: AutosaveHost = {
      setInterval: (handler, timeout) => {
        expect(timeout).toBe(SAVE_CONFIG.autosaveSeconds * 1_000)
        interval = handler
        return 7
      },
      clearInterval: vi.fn(),
      addEventListener: (_type, listener) => {
        pageHide = listener
      },
      removeEventListener: vi.fn(),
    }
    const cleanup = installRuntimeAutosave(storage, host)

    setHollenNearby(true)
    expect(storage.entries.size).toBe(0)
    emitQuestEvent('talkedToHollen')
    expect(storage.entries.has(SAVE_CONFIG.storageKey)).toBe(true)
    storage.entries.clear()
    markCampLeaderDefeated({ x: 1, y: 2, z: 3 })
    expect(storage.entries.has(SAVE_CONFIG.storageKey)).toBe(true)
    storage.entries.clear()
    world.notify()
    expect(storage.entries.has(SAVE_CONFIG.storageKey)).toBe(true)
    storage.entries.clear()
    ;(interval as (() => void) | null)?.()
    expect(storage.entries.has(SAVE_CONFIG.storageKey)).toBe(true)
    storage.entries.clear()
    playerStore.getState().death.phase = 'Fading'
    ;(interval as (() => void) | null)?.()
    expect(storage.entries.size).toBe(0)
    playerStore.getState().death.phase = 'Alive'
    playerStore.getState().vitals.health = 0
    ;(interval as (() => void) | null)?.()
    expect(storage.entries.size).toBe(0)
    ;(pageHide as (() => void) | null)?.()
    expect(storage.entries.has(SAVE_CONFIG.storageKey)).toBe(true)

    cleanup()
    expect(host.clearInterval).toHaveBeenCalledWith(7)
    expect(host.removeEventListener).toHaveBeenCalled()

    configureSaveWorldRuntimeAdapter(null)
    installRuntimeAutosave(storage, host)()
  })

  it('autosaves on pause open and counts exactly 30 unpaused seconds', () => {
    resetPauseRuntime()
    const storage = memoryStorage()
    let interval: (() => void) | null = null
    const host: AutosaveHost = {
      setInterval: (handler) => {
        interval = handler
        return 9
      },
      clearInterval: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const cleanup = installRuntimeAutosave(storage, host)

    setPauseOpen(true)
    expect(storage.entries.has(SAVE_CONFIG.storageKey)).toBe(true)
    storage.entries.clear()
    ;(interval as (() => void) | null)?.()
    expect(storage.entries.size).toBe(0)

    advancePausableClock(120)
    expect(storage.entries.size).toBe(0)

    setPauseOpen(false)
    advancePausableClock(29)
    expect(storage.entries.size).toBe(0)
    setPauseOpen(true)
    expect(storage.entries.has(SAVE_CONFIG.storageKey)).toBe(true)
    storage.entries.clear()
    advancePausableClock(300)
    expect(storage.entries.size).toBe(0)
    setPauseOpen(false)
    advancePausableClock(1)
    expect(storage.entries.has(SAVE_CONFIG.storageKey)).toBe(true)

    cleanup()
    resetPauseRuntime()
  })
})
