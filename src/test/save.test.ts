import { describe, expect, it, vi } from 'vitest'
import { PLAYER } from '../data/player'
import { SAVE_CONFIG } from '../data/quests'
import { ZONE } from '../data/zone'
import { applyQuestEvent, createQuestState } from '../game/quest/quest'
import {
  getCampKeyDropBlockers,
  isKeyDropPointClear,
} from '../game/quest/keyDrop'
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
  type SaveDataV2,
  type SaveStorage,
  type ScenePositionRules,
} from '../game/save/save'

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

function questAt(step: 1 | 2 | 3 | 4 | 5 | 6, complete = false) {
  let quest = createQuestState()
  const events = [
    'talkedToHollen',
    'keyLooted',
    'returnedToHollen',
    'crossedPortico',
    'hollowCleared',
    'reportedToHollen',
  ] as const
  const count = complete ? 6 : step - 1
  for (let index = 0; index < count; index += 1) {
    quest = applyQuestEvent(quest, events[index])
  }
  return quest
}

function v1Save() {
  return {
    schemaVersion: 1,
    player: {
      name: 'Runner',
      health: 72,
      stamina: 48,
      position: { x: 12, y: 9, z: -4 },
      cordState: 'Out',
    },
    quest: {
      ...questAt(3),
      completedSteps: [1, 2],
      campLeaderDefeated: true,
    },
  }
}

function validStepTwoWithDrop(): SaveDataV2 {
  return createSaveData({
    player: createNewSaveData().player,
    quest: questAt(2),
    campLeaderDefeated: true,
    keyDrop: { x: 381.25, y: 38.5, z: -235.75 },
  })
}

describe('save v2 serialization and migration', () => {
  it('creates a new game with every v2 field at its default', () => {
    expect(createNewSaveData()).toEqual({
      schemaVersion: 2,
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
        keyDrop: null,
        campCheckpointActive: false,
        deadCampEnemyIds: [],
      },
      world: {
        porticoUnlocked: false,
        currentScene: 'zone',
        hollow: {
          heelstonePassDone: false,
          snagPulled: false,
          encounterDefeated: false,
        },
        tasselEarned: false,
      },
    })
  })

  it('round-trips all v2 fields, exact key drop coordinates, and resets cord state', () => {
    const pendingDrop = validStepTwoWithDrop()
    pendingDrop.quest.campCheckpointActive = true
    pendingDrop.quest.deadCampEnemyIds = [
      'camp-roadBrigand-1',
      'camp-brigandArcher-2',
    ]
    const serialized = JSON.parse(serializeSave(pendingDrop)) as unknown as {
      player: { cordState: string }
    }
    serialized.player.cordState = 'Returning'
    const loaded = deserializeSave(JSON.stringify(serialized))
    expect(loaded.usedFallback).toBe(false)
    expect(loaded.data.player.cordState).toBe('InHand')
    expect(loaded.data.quest.keyDrop).toEqual({
      x: 381.25,
      y: 38.5,
      z: -235.75,
    })
    expect(loaded.data.quest.campCheckpointActive).toBe(true)
    expect(loaded.data.quest.deadCampEnemyIds).toEqual([
      'camp-roadBrigand-1',
      'camp-brigandArcher-2',
    ])

    const hollow = createSaveData({
      player: { health: 64, stamina: 35, position: { x: 4, y: 0, z: 5 } },
      quest: questAt(5),
      campLeaderDefeated: true,
      keyDrop: null,
      world: {
        porticoUnlocked: true,
        currentScene: 'hollow',
        hollow: {
          heelstonePassDone: true,
          snagPulled: true,
          encounterDefeated: false,
        },
        tasselEarned: false,
      },
    })
    expect(deserializeSave(serializeSave(hollow))).toEqual({
      data: hollow,
      usedFallback: false,
      reason: null,
    })
  })

  it('moves a restored pending key out of a camp blocker', () => {
    const save = createNewSaveData()
    save.quest.currentStep = 2
    save.quest.completedSteps = [1]
    save.quest.campLeaderDefeated = true
    const fireX =
      ZONE.locations.D.center[0] + ZONE.placeholders.camp.fireOffset[0]
    const fireZ =
      ZONE.locations.D.center[1] + ZONE.placeholders.camp.fireOffset[1]
    save.quest.keyDrop = { x: fireX, y: 0, z: fireZ }

    const loaded = deserializeSave(serializeSave(save)).data.quest.keyDrop
    expect(loaded).not.toBeNull()
    expect(loaded?.x === fireX && loaded.z === fireZ).toBe(false)
    expect(
      isKeyDropPointClear(loaded!.x, loaded!.z, getCampKeyDropBlockers()),
    ).toBe(true)
  })

  it('uses the default name and accepts an explicit name and null drop', () => {
    const base = {
      health: 100,
      stamina: 100,
      position: { x: 0, y: 8, z: 0 },
    }
    expect(
      createSaveData({
        player: base,
        quest: createQuestState(),
        campLeaderDefeated: false,
      }).player.name,
    ).toBe(SAVE_CONFIG.playerName)
    expect(
      createSaveData({
        player: { ...base, name: 'Runner Two' },
        quest: createQuestState(),
        campLeaderDefeated: false,
        keyDrop: null,
      }).player.name,
    ).toBe('Runner Two')
  })

  it('migrates a valid v1 save and resets unsaved M6 state', () => {
    const migrated = migrateSaveData(v1Save())
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      player: { cordState: 'InHand', position: { x: 12, y: 9, z: -4 } },
      quest: { currentStep: 3, keyDrop: null, campLeaderDefeated: true },
      world: {
        porticoUnlocked: false,
        currentScene: 'zone',
        tasselEarned: false,
      },
    })
    expect(migrated?.quest.campCheckpointActive).toBe(false)
    expect(migrated?.quest.deadCampEnemyIds).toEqual([])

    const completedV1 = v1Save()
    completedV1.quest = {
      ...questAt(6, true),
      completedSteps: [1, 2, 3, 4, 5, 6],
      campLeaderDefeated: true,
    }
    const migratedCompleted = migrateSaveData(completedV1)
    expect(migratedCompleted?.world).toMatchObject({
      porticoUnlocked: true,
      hollow: {
        heelstonePassDone: true,
        snagPulled: true,
        encounterDefeated: true,
      },
      tasselEarned: true,
    })
    expect(validateSaveData(migratedCompleted)).toBe(true)

    const pendingKeyV1 = v1Save()
    pendingKeyV1.quest = {
      ...questAt(2),
      completedSteps: [1],
      campLeaderDefeated: true,
    }
    const migratedPendingKey = migrateSaveData(pendingKeyV1)
    expect(migratedPendingKey?.quest.keyDrop).not.toBeNull()
    expect(validateSaveData(migratedPendingKey)).toBe(true)
  })

  it('loads old v2 saves without camp progress fields using defaults', () => {
    const oldV2 = validStepTwoWithDrop() as unknown as {
      quest: Record<string, unknown>
    }
    delete oldV2.quest.campCheckpointActive
    delete oldV2.quest.deadCampEnemyIds

    const loaded = deserializeSave(JSON.stringify(oldV2))

    expect(loaded.usedFallback).toBe(false)
    expect(loaded.data.quest.campCheckpointActive).toBe(false)
    expect(loaded.data.quest.deadCampEnemyIds).toEqual([])
  })

  it('classifies missing, corrupt, invalid, and newer data', () => {
    expect(deserializeSave(null).reason).toBe('missing')
    expect(deserializeSave('{broken').reason).toBe('corrupt')
    expect(deserializeSave(JSON.stringify({ schemaVersion: 3 })).reason).toBe(
      'newer-version',
    )
    expect(deserializeSave(JSON.stringify({ schemaVersion: '2' })).reason).toBe(
      'invalid',
    )
    expect(migrateSaveData(null)).toBeNull()
  })
})

describe('save v2 validation branches', () => {
  it('rejects invalid roots, schema, player fields, and position fields', () => {
    const cases: unknown[] = [null, [], { schemaVersion: 2 }]
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        value.schemaVersion = 1
      },
      (value) => {
        value.player = null
      },
      (value) => {
        ;(value.player as Record<string, unknown>).name = 7
      },
      (value) => {
        ;(value.player as Record<string, unknown>).name = ' '
      },
      (value) => {
        ;(value.player as Record<string, unknown>).health = '100'
      },
      (value) => {
        ;(value.player as Record<string, unknown>).health = -1
      },
      (value) => {
        ;(value.player as Record<string, unknown>).health = 101
      },
      (value) => {
        ;(value.player as Record<string, unknown>).stamina = null
      },
      (value) => {
        ;(value.player as Record<string, unknown>).stamina = -1
      },
      (value) => {
        ;(value.player as Record<string, unknown>).stamina = 101
      },
      (value) => {
        ;(value.player as Record<string, unknown>).position = null
      },
      (value) => {
        ;(
          (value.player as Record<string, unknown>).position as Record<
            string,
            unknown
          >
        ).x = Number.NaN
      },
      (value) => {
        ;(
          (value.player as Record<string, unknown>).position as Record<
            string,
            unknown
          >
        ).y = Number.POSITIVE_INFINITY
      },
      (value) => {
        ;(
          (value.player as Record<string, unknown>).position as Record<
            string,
            unknown
          >
        ).z = '0'
      },
      (value) => {
        ;(value.player as Record<string, unknown>).cordState = 1
      },
      (value) => {
        ;(value.player as Record<string, unknown>).cordState = 'Missing'
      },
    ]
    const base = createNewSaveData() as unknown as Record<string, unknown>
    for (const mutate of mutations) {
      const value = structuredClone(base)
      mutate(value)
      cases.push(value)
    }
    for (const value of cases) expect(validateSaveData(value)).toBe(false)
  })

  it('rejects every invalid quest shape and relationship', () => {
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        value.quest = null
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).currentStep = '1'
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).currentStep = 1.5
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).currentStep = 0
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).currentStep = 7
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).keyLooted = 'no'
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).campLeaderDefeated = 'no'
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).complete = 'no'
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).completedSteps = null
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).completedSteps = [1]
      },
      (value) => {
        Object.assign(value.quest as Record<string, unknown>, {
          currentStep: 3,
          completedSteps: [1, 3],
          keyLooted: true,
        })
      },
      (value) => {
        Object.assign(value.quest as Record<string, unknown>, {
          currentStep: 3,
          completedSteps: [1, 2],
          keyLooted: true,
          complete: true,
        })
      },
      (value) => {
        Object.assign(value.quest as Record<string, unknown>, {
          currentStep: 5,
          completedSteps: [1, 2, 3, 4, 5, 6],
          keyLooted: true,
          complete: true,
        })
      },
      (value) => {
        Object.assign(value.quest as Record<string, unknown>, {
          currentStep: 3,
          completedSteps: [1, 2],
          keyLooted: false,
        })
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).keyLooted = true
      },
      (value) => {
        delete (value.quest as Record<string, unknown>).keyDrop
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).keyDrop = { x: 1 }
      },
      (value) => {
        value.quest = {
          ...validStepTwoWithDrop().quest,
          currentStep: 3,
          completedSteps: [1, 2],
          keyLooted: true,
          keyDrop: { x: 1, y: 2, z: 3 },
        }
      },
      (value) => {
        Object.assign(value.quest as Record<string, unknown>, {
          campLeaderDefeated: false,
          keyDrop: { x: 1, y: 2, z: 3 },
        })
      },
      (value) => {
        Object.assign(value.quest as Record<string, unknown>, {
          campLeaderDefeated: true,
          keyLooted: false,
          keyDrop: null,
        })
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).campCheckpointActive = 'yes'
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).campCheckpointActive = true
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).deadCampEnemyIds = 'none'
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).deadCampEnemyIds = [
          'camp-leader',
        ]
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).deadCampEnemyIds = [7]
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).deadCampEnemyIds = [
          'camp-roadBrigand-1',
          'camp-roadBrigand-1',
        ]
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).deadCampEnemyIds = [
          'camp-roadBrigand-1',
        ]
      },
    ]
    const base = createNewSaveData() as unknown as Record<string, unknown>
    for (const mutate of mutations) {
      const value = structuredClone(base)
      mutate(value)
      expect(validateSaveData(value)).toBe(false)
    }
    expect(validateSaveData(validStepTwoWithDrop())).toBe(true)
    const complete = createSaveData({
      player: createNewSaveData().player,
      quest: questAt(6, true),
      campLeaderDefeated: true,
      world: {
        porticoUnlocked: true,
        currentScene: 'zone',
        hollow: {
          heelstonePassDone: true,
          snagPulled: true,
          encounterDefeated: true,
        },
        tasselEarned: true,
      },
    })
    expect(validateSaveData(complete)).toBe(true)
    const invalidV1 = v1Save()
    invalidV1.player.name = ''
    expect(migrateSaveData(invalidV1)).toBeNull()
  })

  it('rejects every invalid world shape and relationship', () => {
    const stepFour = createSaveData({
      player: createNewSaveData().player,
      quest: questAt(4),
      campLeaderDefeated: true,
      world: {
        porticoUnlocked: true,
        currentScene: 'zone',
        hollow: {
          heelstonePassDone: false,
          snagPulled: false,
          encounterDefeated: false,
        },
        tasselEarned: false,
      },
    })
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => {
        value.world = null
      },
      (value) => {
        ;(value.world as Record<string, unknown>).porticoUnlocked = 'yes'
      },
      (value) => {
        ;(value.world as Record<string, unknown>).currentScene = 'elsewhere'
      },
      (value) => {
        ;(value.world as Record<string, unknown>).hollow = null
      },
      (value) => {
        ;(
          (value.world as Record<string, unknown>).hollow as Record<
            string,
            unknown
          >
        ).heelstonePassDone = 1
      },
      (value) => {
        ;(
          (value.world as Record<string, unknown>).hollow as Record<
            string,
            unknown
          >
        ).snagPulled = 1
      },
      (value) => {
        ;(
          (value.world as Record<string, unknown>).hollow as Record<
            string,
            unknown
          >
        ).encounterDefeated = 1
      },
      (value) => {
        ;(value.world as Record<string, unknown>).tasselEarned = 'yes'
      },
      (value) => {
        ;(value.quest as Record<string, unknown>).keyLooted = false
      },
      (value) => {
        Object.assign(value.quest as Record<string, unknown>, {
          currentStep: 3,
          completedSteps: [1, 2],
          keyLooted: true,
        })
      },
      (value) => {
        Object.assign(value.quest as Record<string, unknown>, {
          currentStep: 2,
          completedSteps: [1],
          keyLooted: false,
        })
      },
      (value) => {
        Object.assign(value.world as Record<string, unknown>, {
          currentScene: 'hollow',
          porticoUnlocked: false,
        })
      },
      (value) => {
        ;(value.world as Record<string, unknown>).currentScene = 'hollow'
      },
      (value) => {
        ;(
          (value.world as Record<string, unknown>).hollow as Record<
            string,
            unknown
          >
        ).heelstonePassDone = true
      },
      (value) => {
        ;(value.world as Record<string, unknown>).tasselEarned = true
      },
    ]
    for (const mutate of mutations) {
      const value = structuredClone(stepFour) as unknown as Record<
        string,
        unknown
      >
      mutate(value)
      expect(validateSaveData(value)).toBe(false)
    }
    const stepFive = createSaveData({
      player: createNewSaveData().player,
      quest: questAt(5),
      campLeaderDefeated: true,
      world: {
        porticoUnlocked: true,
        currentScene: 'hollow',
        hollow: {
          heelstonePassDone: false,
          snagPulled: false,
          encounterDefeated: false,
        },
        tasselEarned: false,
      },
    })
    expect(validateSaveData(stepFive)).toBe(true)

    const lockedStepFive = structuredClone(stepFive)
    lockedStepFive.world.currentScene = 'zone'
    lockedStepFive.world.porticoUnlocked = false
    expect(validateSaveData(lockedStepFive)).toBe(false)

    const impossibleEncounter = structuredClone(stepFive)
    impossibleEncounter.world.hollow.encounterDefeated = true
    expect(validateSaveData(impossibleEncounter)).toBe(false)

    const incompleteStepSix = createSaveData({
      player: createNewSaveData().player,
      quest: questAt(6),
      campLeaderDefeated: true,
      world: {
        porticoUnlocked: true,
        currentScene: 'hollow',
        hollow: {
          heelstonePassDone: true,
          snagPulled: true,
          encounterDefeated: false,
        },
        tasselEarned: false,
      },
    })
    expect(validateSaveData(incompleteStepSix)).toBe(false)
  })
})

describe('localStorage v2 adapter', () => {
  it('writes and loads v2, preferring it over a stale legacy save', () => {
    const current = validStepTwoWithDrop()
    const storage = memoryStorage({
      [SAVE_CONFIG.storageKey]: serializeSave(current),
      [SAVE_CONFIG.legacyStorageKey]: JSON.stringify(v1Save()),
    })
    const warn = vi.fn()
    expect(loadSave(storage, warn)).toEqual(current)
    expect(warn).not.toHaveBeenCalled()
    expect(saveToStorage(storage, current, warn)).toBe(true)
  })

  it('migrates a legacy key into the v2 key without warning', () => {
    const storage = memoryStorage({
      [SAVE_CONFIG.legacyStorageKey]: JSON.stringify(v1Save()),
    })
    const warn = vi.fn()
    const loaded = loadSave(storage, warn)
    expect(loaded.schemaVersion).toBe(2)
    expect(storage.entries.has(SAVE_CONFIG.storageKey)).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns once for missing, corrupt, invalid, and newer current saves', () => {
    const inputs: Array<Record<string, string>> = [
      {},
      { [SAVE_CONFIG.storageKey]: '{broken' },
      { [SAVE_CONFIG.storageKey]: JSON.stringify({ schemaVersion: 2 }) },
      { [SAVE_CONFIG.storageKey]: JSON.stringify({ schemaVersion: 3 }) },
    ]
    for (const input of inputs) {
      const warn = vi.fn()
      expect(loadSave(memoryStorage(input), warn)).toEqual(createNewSaveData())
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledWith(SAVE_LOAD_WARNING)
    }
  })

  it('handles current and legacy read failures and write failures', () => {
    const warn = vi.fn()
    const currentReadFailure: SaveStorage = {
      getItem: () => {
        throw new Error('read')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    }
    expect(loadSave(currentReadFailure, warn)).toEqual(createNewSaveData())

    let reads = 0
    const legacyReadFailure: SaveStorage = {
      getItem: () => {
        reads += 1
        if (reads === 1) return null
        throw new Error('legacy read')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    }
    expect(loadSave(legacyReadFailure, warn)).toEqual(createNewSaveData())

    const writeFailure: SaveStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('write')
      },
      removeItem: () => undefined,
    }
    expect(saveToStorage(writeFailure, createNewSaveData(), warn)).toBe(false)
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it('clears both current and legacy keys', () => {
    const storage = memoryStorage({
      [SAVE_CONFIG.storageKey]: 'current',
      [SAVE_CONFIG.legacyStorageKey]: 'legacy',
    })
    clearSave(storage)
    expect(storage.entries.size).toBe(0)
  })
})

describe('scene-aware loaded position safety', () => {
  const rules: ScenePositionRules = {
    zone: {
      bounds: { minimumX: -10, maximumX: 10, minimumZ: -10, maximumZ: 10 },
      respawn: { x: 0, y: 8, z: 0 },
      heightAt: () => 8,
    },
    hollow: {
      bounds: { minimumX: -60, maximumX: 60, minimumZ: -60, maximumZ: 60 },
      respawn: { x: 0, y: 0, z: 3 },
      heightAt: () => 0,
    },
  }

  it('keeps valid saved zone and Hollow positions as copies', () => {
    const zone = createNewSaveData()
    zone.player.position = { x: 10, y: 8, z: -10 }
    const loadedZone = resolveLoadedPosition(zone, rules)
    expect(loadedZone).toEqual(zone.player.position)
    expect(loadedZone).not.toBe(zone.player.position)

    const hollow = createSaveData({
      player: { health: 100, stamina: 100, position: { x: 30, y: 1, z: -20 } },
      quest: questAt(5),
      campLeaderDefeated: true,
      world: {
        porticoUnlocked: true,
        currentScene: 'hollow',
        hollow: {
          heelstonePassDone: false,
          snagPulled: false,
          encounterDefeated: false,
        },
        tasselEarned: false,
      },
    })
    expect(resolveLoadedPosition(hollow, rules)).toEqual({
      x: 30,
      y: 1,
      z: -20,
    })
  })

  it('uses the active scene respawn for each unsafe condition', () => {
    const data = createNewSaveData()
    const invalidPositions = [
      { x: -11, y: 9, z: 0 },
      { x: 11, y: 9, z: 0 },
      { x: 0, y: 9, z: -11 },
      { x: 0, y: 9, z: 11 },
      { x: 0, y: 7, z: 0 },
    ]
    for (const position of invalidPositions) {
      data.player.position = position
      expect(resolveLoadedPosition(data, rules)).toEqual({ x: 0, y: 8, z: 0 })
    }
    data.player.position = { x: 0, y: 9, z: 0 }
    data.player.health = 0
    expect(resolveLoadedPosition(data, rules)).toEqual({ x: 0, y: 8, z: 0 })

    data.player.health = 100
    data.player.position = { x: 0, y: 8, z: 0 }
    expect(resolveLoadedPosition(data, () => 8)).toEqual(data.player.position)
  })
})
