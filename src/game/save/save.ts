import { CAMP_LEADER, ENEMY_SPAWNS } from '../../data/enemies'
import { PLAYER } from '../../data/player'
import {
  FRAME_SHELTER_KEY,
  SAVE_CONFIG,
  type QuestStepId,
} from '../../data/quests'
import { ZONE } from '../../data/zone'
import type { QuestState } from '../quest/quest'
import { isValidDeadCampEnemyIds } from '../enemies/campProgress'
import type { CordMode } from '../weapons/cordState'
import { heightAt } from '../world/terrain'

export type SavedPosition = { x: number; y: number; z: number }
export type GameScene = 'zone' | 'hollow'

export type SavePlayerState = {
  name: string
  health: number
  stamina: number
  position: SavedPosition
  cordState: 'InHand'
}

export type SaveQuestStateV1 = QuestState & { campLeaderDefeated: boolean }
export type SaveQuestState = SaveQuestStateV1 & {
  keyDrop: SavedPosition | null
  campCheckpointActive: boolean
  deadCampEnemyIds: string[]
}

export type SaveHollowProgress = {
  heelstonePassDone: boolean
  snagPulled: boolean
  encounterDefeated: boolean
}

export type SaveWorldState = {
  porticoUnlocked: boolean
  currentScene: GameScene
  hollow: SaveHollowProgress
  tasselEarned: boolean
}

export type SaveDataV1 = {
  schemaVersion: 1
  player: SavePlayerState
  quest: SaveQuestStateV1
}

export type SaveDataV2 = {
  schemaVersion: 2
  player: SavePlayerState
  quest: SaveQuestState
  world: SaveWorldState
}

export type SaveData = SaveDataV2

type StoredPlayerState = Omit<SavePlayerState, 'cordState'> & {
  cordState: CordMode
}
type StoredSaveDataV1 = Omit<SaveDataV1, 'player'> & {
  player: StoredPlayerState
}
type StoredSaveQuestStateV2 = SaveQuestStateV1 & {
  keyDrop: SavedPosition | null
  campCheckpointActive?: boolean
  deadCampEnemyIds?: string[]
}
type StoredSaveDataV2 = Omit<SaveDataV2, 'player' | 'quest'> & {
  player: StoredPlayerState
  quest: StoredSaveQuestStateV2
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
  keyDrop?: SavedPosition | null
  campCheckpointActive?: boolean
  deadCampEnemyIds?: readonly string[]
  world?: SaveWorldState
}

export type SaveFallbackReason =
  'missing' | 'corrupt' | 'invalid' | 'newer-version'

export type SaveLoadResult = {
  data: SaveDataV2
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

export type ScenePositionRule = {
  readonly bounds: {
    readonly minimumX: number
    readonly maximumX: number
    readonly minimumZ: number
    readonly maximumZ: number
  }
  readonly respawn: SavedPosition
  readonly heightAt: HeightSampler
}
export type ScenePositionRules = Record<GameScene, ScenePositionRule>

export const SAVE_LOAD_WARNING =
  'Cord and Crossing save could not be loaded. Starting a new game.'

const CORD_MODES: readonly CordMode[] = [
  'InHand',
  'Out',
  'Returning',
  'Cut',
  'Dropped',
]
const EMPTY_HOLLOW_PROGRESS: SaveHollowProgress = {
  heelstonePassDone: false,
  snagPulled: false,
  encounterDefeated: false,
}
const NEW_WORLD_STATE: SaveWorldState = {
  porticoUnlocked: false,
  currentScene: 'zone',
  hollow: EMPTY_HOLLOW_PROGRESS,
  tasselEarned: false,
}
const legacyLeaderX = ENEMY_SPAWNS.camp.anchor[0] + CAMP_LEADER.campOffset[0]
const legacyLeaderZ = ENEMY_SPAWNS.camp.anchor[1] + CAMP_LEADER.campOffset[1]
const LEGACY_PENDING_KEY_DROP: SavedPosition = {
  x: legacyLeaderX,
  y:
    heightAt(legacyLeaderX, legacyLeaderZ) +
    FRAME_SHELTER_KEY.presentation.ringRadius,
  z: legacyLeaderZ,
}

export function createDefaultWorldState(): SaveWorldState {
  return copyWorld(NEW_WORLD_STATE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSavedPosition(value: unknown): value is SavedPosition {
  if (!isRecord(value)) return false
  if (!isFiniteNumber(value.x)) return false
  if (!isFiniteNumber(value.y)) return false
  return isFiniteNumber(value.z)
}

function isQuestStep(value: unknown): value is QuestStepId {
  if (typeof value !== 'number') return false
  if (!Number.isInteger(value)) return false
  return value >= 1 && value <= 6
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

function isStoredPlayer(value: unknown): value is StoredPlayerState {
  if (!isRecord(value)) return false
  if (typeof value.name !== 'string') return false
  if (value.name.trim().length === 0) return false
  if (!isFiniteNumber(value.health)) return false
  if (value.health < 0 || value.health > PLAYER.health.max) return false
  if (!isFiniteNumber(value.stamina)) return false
  if (value.stamina < 0 || value.stamina > PLAYER.stamina.max) return false
  if (!isSavedPosition(value.position)) return false
  if (typeof value.cordState !== 'string') return false
  return CORD_MODES.includes(value.cordState as CordMode)
}

function isStoredQuestV1(value: unknown): value is SaveQuestStateV1 {
  if (!isRecord(value)) return false
  if (!isQuestStep(value.currentStep)) return false
  if (typeof value.keyLooted !== 'boolean') return false
  if (typeof value.campLeaderDefeated !== 'boolean') return false
  if (typeof value.complete !== 'boolean') return false
  if (
    !isCompletedStepPrefix(
      value.completedSteps,
      value.currentStep,
      value.complete,
    )
  )
    return false
  if (value.complete && value.currentStep !== 6) return false
  if (value.currentStep >= 3 && !value.keyLooted) return false
  if (value.currentStep <= 2 && value.keyLooted) return false
  return true
}

function isStoredQuestV2(value: unknown): value is StoredSaveQuestStateV2 {
  if (!isStoredQuestV1(value)) return false
  const candidate = value as SaveQuestStateV1 & {
    keyDrop?: unknown
    campCheckpointActive?: unknown
    deadCampEnemyIds?: unknown
  }
  if (candidate.keyDrop !== null && !isSavedPosition(candidate.keyDrop)) {
    return false
  }
  if (candidate.keyLooted && candidate.keyDrop !== null) return false
  if (candidate.keyDrop !== null && !candidate.campLeaderDefeated) return false
  if (
    candidate.campLeaderDefeated &&
    !candidate.keyLooted &&
    candidate.keyDrop === null
  )
    return false
  if (
    candidate.campCheckpointActive !== undefined &&
    typeof candidate.campCheckpointActive !== 'boolean'
  )
    return false
  if (
    candidate.campCheckpointActive === true &&
    (candidate.currentStep !== 2 || candidate.keyLooted)
  )
    return false
  if (
    candidate.deadCampEnemyIds !== undefined &&
    !isValidDeadCampEnemyIds(candidate.deadCampEnemyIds)
  )
    return false
  if (
    Array.isArray(candidate.deadCampEnemyIds) &&
    candidate.deadCampEnemyIds.length > 0 &&
    candidate.currentStep < 2
  )
    return false
  return true
}

function isHollowProgress(value: unknown): value is SaveHollowProgress {
  if (!isRecord(value)) return false
  if (typeof value.heelstonePassDone !== 'boolean') return false
  if (typeof value.snagPulled !== 'boolean') return false
  return typeof value.encounterDefeated === 'boolean'
}

function isWorldState(
  value: unknown,
  quest: SaveQuestStateV1,
): value is SaveWorldState {
  if (!isRecord(value)) return false
  if (typeof value.porticoUnlocked !== 'boolean') return false
  if (value.currentScene !== 'zone' && value.currentScene !== 'hollow') {
    return false
  }
  if (!isHollowProgress(value.hollow)) return false
  if (typeof value.tasselEarned !== 'boolean') return false
  if (value.porticoUnlocked && (!quest.keyLooted || quest.currentStep < 4)) {
    return false
  }
  if (value.currentScene === 'hollow' && !value.porticoUnlocked) return false
  if (value.currentScene === 'hollow' && quest.currentStep < 5) return false
  if (quest.currentStep >= 5 && !value.porticoUnlocked) return false
  if (
    quest.currentStep < 5 &&
    (value.hollow.heelstonePassDone ||
      value.hollow.snagPulled ||
      value.hollow.encounterDefeated)
  )
    return false
  if (value.hollow.encounterDefeated && !value.hollow.snagPulled) return false
  if (
    quest.currentStep >= 6 &&
    (!value.hollow.heelstonePassDone ||
      !value.hollow.snagPulled ||
      !value.hollow.encounterDefeated)
  )
    return false
  if (value.tasselEarned !== quest.complete) return false
  return true
}

function isStoredSaveDataV1(value: unknown): value is StoredSaveDataV1 {
  if (!isRecord(value)) return false
  if (value.schemaVersion !== 1) return false
  if (!isStoredPlayer(value.player)) return false
  return isStoredQuestV1(value.quest)
}

function isStoredSaveDataV2(value: unknown): value is StoredSaveDataV2 {
  if (!isRecord(value)) return false
  if (value.schemaVersion !== SAVE_CONFIG.schemaVersion) return false
  if (!isStoredPlayer(value.player)) return false
  if (!isStoredQuestV2(value.quest)) return false
  return isWorldState(value.world, value.quest)
}

function copyPlayer(value: StoredPlayerState): SavePlayerState {
  return {
    name: value.name,
    health: value.health,
    stamina: value.stamina,
    position: { ...value.position },
    cordState: 'InHand',
  }
}

function copyQuestV1(value: SaveQuestStateV1): SaveQuestStateV1 {
  return {
    currentStep: value.currentStep,
    completedSteps: [...value.completedSteps],
    keyLooted: value.keyLooted,
    complete: value.complete,
    campLeaderDefeated: value.campLeaderDefeated,
  }
}

function copyWorld(value: SaveWorldState): SaveWorldState {
  return {
    porticoUnlocked: value.porticoUnlocked,
    currentScene: value.currentScene,
    hollow: { ...value.hollow },
    tasselEarned: value.tasselEarned,
  }
}

function copySaveDataV2(value: StoredSaveDataV2): SaveDataV2 {
  return {
    schemaVersion: SAVE_CONFIG.schemaVersion,
    player: copyPlayer(value.player),
    quest: {
      ...copyQuestV1(value.quest),
      keyDrop: value.quest.keyDrop === null ? null : { ...value.quest.keyDrop },
      campCheckpointActive: value.quest.campCheckpointActive ?? false,
      deadCampEnemyIds: [...(value.quest.deadCampEnemyIds ?? [])],
    },
    world: copyWorld(value.world),
  }
}

function migrateV1(value: StoredSaveDataV1): SaveDataV2 {
  const pendingLegacyKey =
    value.quest.campLeaderDefeated && !value.quest.keyLooted
  const crossedPortico = value.quest.currentStep >= 5
  const clearedHollow = value.quest.currentStep >= 6
  return {
    schemaVersion: SAVE_CONFIG.schemaVersion,
    player: copyPlayer(value.player),
    quest: {
      ...copyQuestV1(value.quest),
      keyDrop: pendingLegacyKey ? { ...LEGACY_PENDING_KEY_DROP } : null,
      campCheckpointActive: false,
      deadCampEnemyIds: [],
    },
    world: {
      ...copyWorld(NEW_WORLD_STATE),
      porticoUnlocked: crossedPortico,
      hollow: {
        heelstonePassDone: clearedHollow,
        snagPulled: clearedHollow,
        encounterDefeated: clearedHollow,
      },
      tasselEarned: value.quest.complete,
    },
  }
}

export function createNewSaveData(): SaveDataV2 {
  return {
    schemaVersion: SAVE_CONFIG.schemaVersion,
    player: {
      name: SAVE_CONFIG.playerName,
      health: PLAYER.health.max,
      stamina: PLAYER.stamina.max,
      position: { x: ZONE.spawn[0], y: ZONE.spawn[1], z: ZONE.spawn[2] },
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
    world: copyWorld(NEW_WORLD_STATE),
  }
}

export function createSaveData(input: SaveSnapshotInput): SaveDataV2 {
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
      keyDrop:
        input.keyDrop === undefined || input.keyDrop === null
          ? null
          : { ...input.keyDrop },
      campCheckpointActive: input.campCheckpointActive ?? false,
      deadCampEnemyIds: [...(input.deadCampEnemyIds ?? [])],
    },
    world: copyWorld(input.world ?? NEW_WORLD_STATE),
  }
}

export function validateSaveData(value: unknown): value is StoredSaveDataV2 {
  return isStoredSaveDataV2(value)
}

export function migrateSaveData(value: unknown): SaveDataV2 | null {
  if (isStoredSaveDataV2(value)) return copySaveDataV2(value)
  if (isStoredSaveDataV1(value)) return migrateV1(value)
  return null
}

export function serializeSave(data: SaveDataV2): string {
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
  if (migrated === null) {
    return { data: createNewSaveData(), usedFallback: true, reason: 'invalid' }
  }
  return { data: migrated, usedFallback: false, reason: null }
}

export function loadSave(
  storage: SaveStorage,
  warn: SaveWarning = console.warn,
): SaveDataV2 {
  let current: string | null
  try {
    current = storage.getItem(SAVE_CONFIG.storageKey)
  } catch {
    warn(SAVE_LOAD_WARNING)
    return createNewSaveData()
  }
  if (current !== null) {
    const result = deserializeSave(current)
    if (result.usedFallback) warn(SAVE_LOAD_WARNING)
    return result.data
  }
  let legacy: string | null
  try {
    legacy = storage.getItem(SAVE_CONFIG.legacyStorageKey)
  } catch {
    warn(SAVE_LOAD_WARNING)
    return createNewSaveData()
  }
  const result = deserializeSave(legacy)
  if (result.usedFallback) {
    warn(SAVE_LOAD_WARNING)
    return result.data
  }
  saveToStorage(storage, result.data, warn)
  return result.data
}

export function saveToStorage(
  storage: SaveStorage,
  data: SaveDataV2,
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
  storage.removeItem(SAVE_CONFIG.legacyStorageKey)
}

function zonePositionRule(heightAt: HeightSampler): ScenePositionRule {
  return {
    bounds: ZONE.bounds,
    respawn: { x: ZONE.spawn[0], y: ZONE.spawn[1], z: ZONE.spawn[2] },
    heightAt,
  }
}

export function resolveLoadedPosition(
  data: SaveDataV2,
  source: HeightSampler | ScenePositionRules,
): SavedPosition {
  const rule =
    typeof source === 'function'
      ? zonePositionRule(source)
      : source[data.world.currentScene]
  const position = data.player.position
  const inBounds =
    position.x >= rule.bounds.minimumX &&
    position.x <= rule.bounds.maximumX &&
    position.z >= rule.bounds.minimumZ &&
    position.z <= rule.bounds.maximumZ
  const aboveTerrain =
    inBounds && position.y >= rule.heightAt(position.x, position.z)
  if (data.player.health > 0 && aboveTerrain) return { ...position }
  return { ...rule.respawn }
}
