import { describe, expect, it, vi } from 'vitest'
import { PLAYER } from '../data/player'
import { SAVE_CONFIG } from '../data/quests'
import { applyQuestEvent, createQuestState } from '../game/quest/quest'
import {
  SAVE_LOAD_WARNING,
  clearSave,
  createNewSaveData,
  createSaveData,
  deserializeSave,
  loadSave,
  migrateSaveData,
  resolveLoadedPosition,
  saveToStorage,
  serializeSave,
  validateSaveData,
  type SaveStorage,
} from '../game/save/save'

type MutableRawSave = {
  player: {
    name: unknown
    health: unknown
    stamina: unknown
    position: { x: unknown }
    cordState: unknown
  }
  quest: {
    currentStep: unknown
    completedSteps: unknown
    keyLooted: unknown
    campLeaderDefeated: unknown
    complete: unknown
  }
}

function memoryStorage(initial: string | null = null): SaveStorage {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key, nextValue) => {
      value = nextValue
    },
    removeItem: () => {
      value = null
    },
  }
}

function stepThreeQuest() {
  let quest = createQuestState()
  quest = applyQuestEvent(quest, 'talkedToHollen')
  quest = applyQuestEvent(quest, 'keyLooted')
  return quest
}

describe('save serialization and validation', () => {
  it('creates a new game at the waystation with full vitals', () => {
    expect(createNewSaveData()).toEqual({
      schemaVersion: 1,
      player: {
        name: 'Runner',
        health: PLAYER.health.max,
        stamina: PLAYER.stamina.max,
        position: { x: 0, y: 8, z: 0 },
        cordState: 'InHand',
      },
      quest: {
        currentStep: 1,
        completedSteps: [],
        keyLooted: false,
        complete: false,
        campLeaderDefeated: false,
      },
    })
  })

  it('round-trips player and quest state and resets the cord to In Hand', () => {
    const data = createSaveData({
      player: {
        name: 'Runner',
        health: 72,
        stamina: 48,
        position: { x: 12, y: 9, z: -4 },
      },
      quest: stepThreeQuest(),
      campLeaderDefeated: true,
    })
    const loaded = deserializeSave(serializeSave(data))
    expect(loaded).toEqual({ data, usedFallback: false, reason: null })

    const storedOut = JSON.parse(serializeSave(data)) as MutableRawSave
    storedOut.player.cordState = 'Out'
    expect(migrateSaveData(storedOut)?.player.cordState).toBe('InHand')
  })

  it('uses the default player name when a snapshot omits it', () => {
    const data = createSaveData({
      player: {
        health: 100,
        stamina: 100,
        position: { x: 0, y: 8, z: 0 },
      },
      quest: createQuestState(),
      campLeaderDefeated: false,
    })
    expect(data.player.name).toBe(SAVE_CONFIG.playerName)
  })

  it('rejects corrupt JSON, wrong types, missing fields, and newer versions', () => {
    expect(deserializeSave('{broken').reason).toBe('corrupt')
    expect(deserializeSave(null).reason).toBe('missing')
    expect(deserializeSave(JSON.stringify({ schemaVersion: 2 })).reason).toBe(
      'newer-version',
    )
    expect(
      deserializeSave(
        JSON.stringify({ schemaVersion: 1, player: {}, quest: {} }),
      ).reason,
    ).toBe('invalid')
    expect(validateSaveData({ schemaVersion: 1 })).toBe(false)
  })

  it('rejects invalid vitals, positions, cord modes, and quest shapes', () => {
    const base = JSON.parse(
      serializeSave(createNewSaveData()),
    ) as MutableRawSave
    const mutations: Array<(value: MutableRawSave) => void> = [
      (value) => {
        value.player.name = ''
      },
      (value) => {
        value.player.health = -1
      },
      (value) => {
        value.player.health = PLAYER.health.max + 1
      },
      (value) => {
        value.player.stamina = -1
      },
      (value) => {
        value.player.stamina = PLAYER.stamina.max + 1
      },
      (value) => {
        value.player.position.x = Number.NaN
      },
      (value) => {
        value.player.cordState = 'Missing'
      },
      (value) => {
        value.quest.currentStep = 0
      },
      (value) => {
        value.quest.completedSteps = [2]
      },
      (value) => {
        value.quest.keyLooted = 'yes'
      },
      (value) => {
        value.quest.campLeaderDefeated = 'yes'
      },
      (value) => {
        value.quest.complete = 'yes'
      },
    ]

    for (const mutate of mutations) {
      const value = structuredClone(base)
      mutate(value)
      expect(validateSaveData(value)).toBe(false)
    }
  })

  it('requires completed steps and key state to agree with progression', () => {
    const stepThree = createSaveData({
      player: createNewSaveData().player,
      quest: stepThreeQuest(),
      campLeaderDefeated: true,
    })
    expect(validateSaveData(stepThree)).toBe(true)

    const missingKey = structuredClone(stepThree)
    missingKey.quest.keyLooted = false
    expect(validateSaveData(missingKey)).toBe(false)

    const earlyKey = createNewSaveData()
    earlyKey.quest.keyLooted = true
    expect(validateSaveData(earlyKey)).toBe(false)

    const impossibleComplete = structuredClone(stepThree)
    impossibleComplete.quest.complete = true
    expect(validateSaveData(impossibleComplete)).toBe(false)
  })
})

describe('localStorage adapter', () => {
  it('writes, loads, and clears a save', () => {
    const storage = memoryStorage()
    const data = createNewSaveData()
    const warn = vi.fn()
    expect(saveToStorage(storage, data, warn)).toBe(true)
    expect(loadSave(storage, warn)).toEqual(data)
    expect(warn).not.toHaveBeenCalled()
    clearSave(storage)
    expect(storage.getItem(SAVE_CONFIG.storageKey)).toBeNull()
  })

  it('warns exactly once and starts a new game for invalid input', () => {
    for (const serialized of [
      null,
      '{broken',
      JSON.stringify({ schemaVersion: 2 }),
    ]) {
      const warn = vi.fn()
      expect(loadSave(memoryStorage(serialized), warn)).toEqual(
        createNewSaveData(),
      )
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledWith(SAVE_LOAD_WARNING)
    }
  })

  it('handles storage read and write failures without throwing', () => {
    const warn = vi.fn()
    const failingStorage: SaveStorage = {
      getItem: () => {
        throw new Error('read failed')
      },
      setItem: () => {
        throw new Error('write failed')
      },
      removeItem: () => undefined,
    }
    expect(loadSave(failingStorage, warn)).toEqual(createNewSaveData())
    expect(saveToStorage(failingStorage, createNewSaveData(), warn)).toBe(false)
    expect(warn).toHaveBeenCalledTimes(2)
  })
})

describe('loaded position safety', () => {
  it('keeps a living player at a valid saved position', () => {
    const data = createNewSaveData()
    data.player.position = { x: 10, y: 12, z: -5 }
    expect(resolveLoadedPosition(data, () => 8)).toEqual(data.player.position)
    expect(resolveLoadedPosition(data, () => 8)).not.toBe(data.player.position)
  })

  it('uses the waystation for an out-of-bounds, buried, or dead player', () => {
    const data = createNewSaveData()
    data.player.position = { x: 851, y: 12, z: 0 }
    expect(resolveLoadedPosition(data, () => 8)).toEqual({ x: 0, y: 8, z: 0 })

    data.player.position = { x: 10, y: 7, z: 0 }
    expect(resolveLoadedPosition(data, () => 8)).toEqual({ x: 0, y: 8, z: 0 })

    data.player.position = { x: 10, y: 12, z: 0 }
    data.player.health = 0
    expect(resolveLoadedPosition(data, () => 8)).toEqual({ x: 0, y: 8, z: 0 })
  })
})
