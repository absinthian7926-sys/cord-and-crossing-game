import { PLAYER } from '../../data/player'
import { SAVE_CONFIG } from '../../data/quests'
import { createPlayerDeathState } from '../player/death'
import { playerStore } from '../player/playerStore'
import {
  getQuestRuntimeSnapshot,
  hydrateQuestRuntime,
  subscribeQuestRuntime,
} from '../quest/questRuntime'
import {
  resetWeaponRuntime,
  resetWeaponToInHand,
} from '../weapons/weaponRuntime'
import {
  clearSave,
  createDefaultWorldState,
  createNewSaveData,
  createSaveData,
  loadSave,
  resolveLoadedPosition,
  saveToStorage,
  type HeightSampler,
  type SaveDataV2,
  type SaveStorage,
  type SaveWarning,
  type SaveWorldState,
  type ScenePositionRules,
} from './save'

export type AutosaveHost = {
  setInterval(handler: () => void, timeoutMilliseconds: number): number
  clearInterval(intervalId: number): void
  addEventListener(type: 'pagehide', listener: () => void): void
  removeEventListener(type: 'pagehide', listener: () => void): void
}

export type LoadRuntimeOptions = { readonly warn?: SaveWarning }

export type SaveWorldRuntimeState = Omit<SaveWorldState, 'tasselEarned'>

export type SaveWorldRuntimeAdapter = {
  getState(): SaveWorldRuntimeState
  hydrate(state: SaveWorldState): void
  subscribe(listener: () => void): () => void
}

const defaultWorld = createDefaultWorldState()
const defaultAdapter: SaveWorldRuntimeAdapter = {
  getState: () => ({
    porticoUnlocked: defaultWorld.porticoUnlocked,
    currentScene: defaultWorld.currentScene,
    hollow: { ...defaultWorld.hollow },
  }),
  hydrate: () => undefined,
  subscribe: () => () => undefined,
}

let worldAdapter: SaveWorldRuntimeAdapter = defaultAdapter

export function configureSaveWorldRuntimeAdapter(
  adapter: SaveWorldRuntimeAdapter | null,
): void {
  worldAdapter = adapter ?? defaultAdapter
}

const PLAYER_GROUND_OFFSET = PLAYER.collider.halfHeight + PLAYER.collider.radius

export function createRuntimeSaveData(): SaveDataV2 {
  const player = playerStore.getState()
  const quest = getQuestRuntimeSnapshot()
  const world = worldAdapter.getState()
  return createSaveData({
    player: {
      health: player.vitals.health,
      stamina: player.vitals.stamina,
      position: {
        x: player.position.x,
        y: player.position.y - PLAYER_GROUND_OFFSET,
        z: player.position.z,
      },
    },
    quest: quest.quest,
    campLeaderDefeated: quest.campLeaderDefeated,
    keyDrop: quest.keyDrop,
    world: {
      ...world,
      hollow: { ...world.hollow },
      tasselEarned: quest.tasselEarned,
    },
  })
}

export function applyRuntimeSaveData(
  data: SaveDataV2,
  positionRules: HeightSampler | ScenePositionRules,
): void {
  worldAdapter.hydrate(data.world)
  const player = playerStore.getState()
  const position = resolveLoadedPosition(data, positionRules)
  player.vitals.health =
    data.player.health > 0 ? data.player.health : PLAYER.health.max
  player.vitals.stamina = data.player.stamina
  player.vitals.secondsSinceDamage = 0
  player.vitals.secondsSinceStaminaUse = 0
  player.vitals.runLocked = false
  player.invulnerable = false
  Object.assign(player.death, createPlayerDeathState())
  player.teleportTarget = {
    x: position.x,
    y: position.y + PLAYER_GROUND_OFFSET,
    z: position.z,
  }
  hydrateQuestRuntime(
    data.quest,
    data.quest.campLeaderDefeated,
    data.quest.keyDrop,
    data.world.tasselEarned,
  )
  resetWeaponRuntime()
  resetWeaponToInHand()
}

export function loadRuntimeSave(
  storage: SaveStorage,
  positionRules: HeightSampler | ScenePositionRules,
  options: LoadRuntimeOptions = {},
): SaveDataV2 {
  const data = loadSave(storage, options.warn)
  applyRuntimeSaveData(data, positionRules)
  return data
}

export function saveRuntimeState(
  storage: SaveStorage,
  warn?: SaveWarning,
): boolean {
  return saveToStorage(storage, createRuntimeSaveData(), warn)
}

export function clearRuntimeSave(
  storage: SaveStorage,
  positionRules: HeightSampler | ScenePositionRules,
): SaveDataV2 {
  clearSave(storage)
  const data = createNewSaveData()
  applyRuntimeSaveData(data, positionRules)
  return data
}

export function installRuntimeAutosave(
  storage: SaveStorage,
  host: AutosaveHost,
  warn?: SaveWarning,
): () => void {
  let lastQuestRevision = getQuestRuntimeSnapshot().questRevision
  const persist = () => saveRuntimeState(storage, warn)
  const unsubscribeQuest = subscribeQuestRuntime(() => {
    const revision = getQuestRuntimeSnapshot().questRevision
    if (revision === lastQuestRevision) return
    lastQuestRevision = revision
    persist()
  })
  const unsubscribeWorld = worldAdapter.subscribe(persist)
  const intervalId = host.setInterval(() => {
    const player = playerStore.getState()
    if (player.death.phase === 'Alive' && player.vitals.health > 0) persist()
  }, SAVE_CONFIG.autosaveSeconds * 1_000)
  const onPageHide = () => persist()
  host.addEventListener('pagehide', onPageHide)

  return () => {
    unsubscribeQuest()
    unsubscribeWorld()
    host.clearInterval(intervalId)
    host.removeEventListener('pagehide', onPageHide)
  }
}
