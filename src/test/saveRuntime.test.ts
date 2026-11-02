import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAYER } from '../data/player'
import { SAVE_CONFIG } from '../data/quests'
import { playerStore } from '../game/player/playerStore'
import {
  emitQuestEvent,
  getQuestRuntimeSnapshot,
  markCampLeaderDefeated,
  resetQuestRuntime,
} from '../game/quest/questRuntime'
import {
  applyRuntimeSaveData,
  clearRuntimeSave,
  createRuntimeSaveData,
  installRuntimeAutosave,
  loadRuntimeSave,
  type AutosaveHost,
} from '../game/save/saveRuntime'
import { createNewSaveData, type SaveStorage } from '../game/save/save'
import { weaponRuntime } from '../game/weapons/weaponRuntime'

function memoryStorage(initial: string | null = null): SaveStorage & {
  value: () => string | null
} {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key, nextValue) => {
      value = nextValue
    },
    removeItem: () => {
      value = null
    },
    value: () => value,
  }
}

describe('save runtime', () => {
  beforeEach(() => {
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

  it('stores the player logical ground position and quest flags', () => {
    const player = playerStore.getState()
    player.position.x = 12
    player.position.y = 10 + PLAYER.collider.halfHeight + PLAYER.collider.radius
    player.position.z = -4
    player.vitals.health = 72
    player.vitals.stamina = 48
    emitQuestEvent('talkedToHollen')
    markCampLeaderDefeated({ x: 380, y: 38, z: -236 })

    const save = createRuntimeSaveData()
    expect(save).toMatchObject({
      player: {
        health: 72,
        stamina: 48,
        position: { x: 12, z: -4 },
        cordState: 'InHand',
      },
      quest: { currentStep: 2, campLeaderDefeated: true },
    })
    expect(save.player.position.y).toBeCloseTo(10)
  })

  it('restores vitals, a safe center position, quest, and cord In Hand', () => {
    const data = createNewSaveData()
    data.player.health = 65
    data.player.stamina = 31
    data.player.position = { x: 10, y: 9, z: -5 }
    data.quest.currentStep = 2
    data.quest.completedSteps = [1]
    data.quest.campLeaderDefeated = true
    weaponRuntime.cord = {
      mode: 'Out',
      castKind: 'straight',
      retieRemaining: 0,
    }

    applyRuntimeSaveData(data, () => 8, { x: 380, y: 38, z: -236 })
    const player = playerStore.getState()
    expect(player.vitals.health).toBe(65)
    expect(player.vitals.stamina).toBe(31)
    expect(player.teleportTarget).toMatchObject({ x: 10, z: -5 })
    expect(player.teleportTarget?.y).toBeCloseTo(
      9 + PLAYER.collider.halfHeight + PLAYER.collider.radius,
    )
    expect(getQuestRuntimeSnapshot().keyDrop).toEqual({
      x: 380,
      y: 38,
      z: -236,
    })
    expect(weaponRuntime.cord.mode).toBe('InHand')
  })

  it('loads and clears storage without browser globals', () => {
    const storage = memoryStorage(JSON.stringify(createNewSaveData()))
    expect(loadRuntimeSave(storage, () => 8).schemaVersion).toBe(1)
    clearRuntimeSave(storage, () => 8)
    expect(storage.value()).toBeNull()
    expect(getQuestRuntimeSnapshot().quest.currentStep).toBe(1)
  })

  it('autosaves progression, leader defeat, alive intervals, and page hide', () => {
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

    emitQuestEvent('talkedToHollen')
    expect(storage.value()).not.toBeNull()
    storage.removeItem(SAVE_CONFIG.storageKey)
    markCampLeaderDefeated({ x: 1, y: 2, z: 3 })
    expect(storage.value()).not.toBeNull()
    storage.removeItem(SAVE_CONFIG.storageKey)
    ;(interval as (() => void) | null)?.()
    expect(storage.value()).not.toBeNull()
    storage.removeItem(SAVE_CONFIG.storageKey)
    ;(pageHide as (() => void) | null)?.()
    expect(storage.value()).not.toBeNull()

    cleanup()
    expect(host.clearInterval).toHaveBeenCalledWith(7)
    expect(host.removeEventListener).toHaveBeenCalled()
  })
})
