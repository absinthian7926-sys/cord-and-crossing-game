import { PLAYER } from '../../data/player'
import { SAVE_CONFIG, type QuestStepId } from '../../data/quests'
import { ZONE } from '../../data/zone'
import type { QuestState } from '../quest/quest'
import type { CordMode } from '../weapons/cordState'

export type SavedPosition = {
  x: number
  y: number
  z: number
}

export type SavePlayerState = {
  name: string
  health: number
  stamina: number
  position: SavedPosition
  cordState: 'InHand'
}

export type SaveQuestState = QuestState & {
  campLeaderDefeated: boolean
}

export type SaveDataV1 = {
  schemaVersion: 1
  player: SavePlayerState
  quest: SaveQuestState
}

type StoredSaveDataV1 = {
  schemaVersion: 1
  player: Omit<SavePlayerState, 'cordState'> & { cordState: CordMode }
  quest: SaveQuestState
}

export type SaveSnapshotInput = {
  player: {
    name?: string
    health: number
    stamina: number
    position: SavedPosition
  }
  quest: QuestState
  campLeaderDefeated: boolean
}

export type SaveFallbackReason =
  'missing' | 'corrupt' | 'invalid' | 'newer-version'

export type SaveLoadResult = {
  data: SaveDataV1
  usedFallback: boolean
  reason: SaveFallbackReason | null
}

export type SaveStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type SaveWarning = (message: string) => void
export type HeightSampler = (x: number, z: number) => number

export const SAVE_LOAD_WARNING =
  'Cord and Crossing save could not be loaded. Starting a new game.'

const CORD_MODES: readonly CordMode[] = [
  'InHand',
  'Out',
  'Returning',
  'Cut',
  'Dropped',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSavedPosition(value: unknown): value is SavedPosition {
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.z)
  )
}

function isQuestStep(value: unknown): value is QuestStepId {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
  )
}

function isCompletedStepPrefix(
  value: unknown,
  currentStep: QuestStepId,
  complete: boolean,
): value is QuestStepId[] {
  if (!Array.isArray(value)) return false
  const expectedLength = complete ? 6 : currentStep - 1
  if (value.length !== expectedLength) return false
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== index + 1) return false
  }
  return true
}

function isStoredSaveDataV1(value: unknown): value is StoredSaveDataV1 {
  if (!isRecord(value) || value.schemaVersion !== SAVE_CONFIG.schemaVersion) {
    return false
  }
  if (!isRecord(value.player) || !isRecord(value.quest)) return false

  const player = value.player
  const quest = value.quest
  if (
    typeof player.name !== 'string' ||
    player.name.trim().length === 0 ||
    !isFiniteNumber(player.health) ||
    player.health < 0 ||
    player.health > PLAYER.health.max ||
    !isFiniteNumber(player.stamina) ||
    player.stamina < 0 ||
    player.stamina > PLAYER.stamina.max ||
    !isSavedPosition(player.position) ||
    typeof player.cordState !== 'string' ||
    !CORD_MODES.includes(player.cordState as CordMode)
  ) {
    return false
  }

  if (
    !isQuestStep(quest.currentStep) ||
    typeof quest.keyLooted !== 'boolean' ||
    typeof quest.campLeaderDefeated !== 'boolean' ||
    typeof quest.complete !== 'boolean' ||
    !isCompletedStepPrefix(
      quest.completedSteps,
      quest.currentStep,
      quest.complete,
    )
  ) {
    return false
  }

  if (quest.complete && quest.currentStep !== 6) return false
  if (
    !quest.complete &&
    quest.currentStep === 6 &&
    quest.completedSteps.length === 6
  ) {
    return false
  }
  if (quest.currentStep >= 3 && !quest.keyLooted) return false
  if (quest.currentStep <= 2 && quest.keyLooted) return false
  return true
}

function copySaveData(value: StoredSaveDataV1): SaveDataV1 {
  return {
    schemaVersion: SAVE_CONFIG.schemaVersion,
    player: {
      name: value.player.name,
      health: value.player.health,
      stamina: value.player.stamina,
      position: { ...value.player.position },
      cordState: 'InHand',
    },
    quest: {
      currentStep: value.quest.currentStep,
      completedSteps: [...value.quest.completedSteps],
      keyLooted: value.quest.keyLooted,
      complete: value.quest.complete,
      campLeaderDefeated: value.quest.campLeaderDefeated,
    },
  }
}

export function createNewSaveData(): SaveDataV1 {
  return {
    schemaVersion: SAVE_CONFIG.schemaVersion,
    player: {
      name: SAVE_CONFIG.playerName,
      health: PLAYER.health.max,
      stamina: PLAYER.stamina.max,
      position: {
        x: ZONE.spawn[0],
        y: ZONE.spawn[1],
        z: ZONE.spawn[2],
      },
      cordState: 'InHand',
    },
    quest: {
      currentStep: 1,
      completedSteps: [],
      keyLooted: false,
      complete: false,
      campLeaderDefeated: false,
    },
  }
}

export function createSaveData(input: SaveSnapshotInput): SaveDataV1 {
  return {
    schemaVersion: SAVE_CONFIG.schemaVersion,
    player: {
      name: input.player.name ?? SAVE_CONFIG.playerName,
      health: input.player.health,
      stamina: input.player.stamina,
      position: { ...input.player.position },
      cordState: 'InHand',
    },
    quest: {
      currentStep: input.quest.currentStep,
      completedSteps: [...input.quest.completedSteps],
      keyLooted: input.quest.keyLooted,
      complete: input.quest.complete,
      campLeaderDefeated: input.campLeaderDefeated,
    },
  }
}

export function validateSaveData(value: unknown): value is StoredSaveDataV1 {
  return isStoredSaveDataV1(value)
}

export function migrateSaveData(value: unknown): SaveDataV1 | null {
  return isStoredSaveDataV1(value) ? copySaveData(value) : null
}

export function serializeSave(data: SaveDataV1): string {
  return JSON.stringify(data)
}

export function deserializeSave(serialized: string | null): SaveLoadResult {
  if (serialized === null) {
    return { data: createNewSaveData(), usedFallback: true, reason: 'missing' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return { data: createNewSaveData(), usedFallback: true, reason: 'corrupt' }
  }

  if (
    isRecord(parsed) &&
    typeof parsed.schemaVersion === 'number' &&
    parsed.schemaVersion > SAVE_CONFIG.schemaVersion
  ) {
    return {
      data: createNewSaveData(),
      usedFallback: true,
      reason: 'newer-version',
    }
  }

  const migrated = migrateSaveData(parsed)
  return migrated === null
    ? { data: createNewSaveData(), usedFallback: true, reason: 'invalid' }
    : { data: migrated, usedFallback: false, reason: null }
}

export function loadSave(
  storage: SaveStorage,
  warn: SaveWarning = console.warn,
): SaveDataV1 {
  let serialized: string | null
  try {
    serialized = storage.getItem(SAVE_CONFIG.storageKey)
  } catch {
    warn(SAVE_LOAD_WARNING)
    return createNewSaveData()
  }

  const result = deserializeSave(serialized)
  if (result.usedFallback) warn(SAVE_LOAD_WARNING)
  return result.data
}

export function saveToStorage(
  storage: SaveStorage,
  data: SaveDataV1,
  warn: SaveWarning = console.warn,
): boolean {
  try {
    storage.setItem(SAVE_CONFIG.storageKey, serializeSave(data))
    return true
  } catch {
    warn('Cord and Crossing save could not be written.')
    return false
  }
}

export function clearSave(storage: SaveStorage): void {
  storage.removeItem(SAVE_CONFIG.storageKey)
}

export function resolveLoadedPosition(
  data: SaveDataV1,
  heightAt: HeightSampler,
): SavedPosition {
  const position = data.player.position
  const inBounds =
    position.x >= ZONE.bounds.minimumX &&
    position.x <= ZONE.bounds.maximumX &&
    position.z >= ZONE.bounds.minimumZ &&
    position.z <= ZONE.bounds.maximumZ
  const aboveTerrain =
    inBounds && position.y >= heightAt(position.x, position.z)

  return data.player.health > 0 && aboveTerrain
    ? { ...position }
    : { x: ZONE.spawn[0], y: ZONE.spawn[1], z: ZONE.spawn[2] }
}
