import { PLAYER } from '../../data/player'
import { SAVE_CONFIG } from '../../data/quests'
import { createPlayerDeathState } from '../player/death'
import { playerStore } from '../player/playerStore'
import {
  getQuestRuntimeSnapshot,
  hydrateQuestRuntime,
  subscribeQuestRuntime,
  type KeyDropPosition,
} from '../quest/questRuntime'
import {
  clearSave,
  createNewSaveData,
  createSaveData,
  loadSave,
  resolveLoadedPosition,
  saveToStorage,
  type HeightSampler,
  type SaveDataV1,
  type SaveStorage,
  type SaveWarning,
} from './save'
import {
  resetWeaponRuntime,
  resetWeaponToInHand,
} from '../weapons/weaponRuntime'

export type AutosaveHost = {
  setInterval(handler: () => void, timeoutMilliseconds: number): number
  clearInterval(intervalId: number): void
  addEventListener(type: 'pagehide', listener: () => void): void
  removeEventListener(type: 'pagehide', listener: () => void): void
}

export type LoadRuntimeOptions = {
  readonly pendingKeyDrop?: KeyDropPosition | null
  readonly warn?: SaveWarning
}

const PLAYER_GROUND_OFFSET = PLAYER.collider.halfHeight + PLAYER.collider.radius

export function createRuntimeSaveData(): SaveDataV1 {
  const player = playerStore.getState()
  const quest = getQuestRuntimeSnapshot()
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
  })
}

export function applyRuntimeSaveData(
  data: SaveDataV1,
  sampleHeight: HeightSampler,
  pendingKeyDrop: KeyDropPosition | null = null,
): void {
  const player = playerStore.getState()
  const position = resolveLoadedPosition(data, sampleHeight)
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
  hydrateQuestRuntime(data.quest, data.quest.campLeaderDefeated, pendingKeyDrop)
  resetWeaponRuntime()
  resetWeaponToInHand()
}

export function loadRuntimeSave(
  storage: SaveStorage,
  sampleHeight: HeightSampler,
  options: LoadRuntimeOptions = {},
): SaveDataV1 {
  const data = loadSave(storage, options.warn)
  applyRuntimeSaveData(data, sampleHeight, options.pendingKeyDrop)
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
  sampleHeight: HeightSampler,
): SaveDataV1 {
  clearSave(storage)
  const data = createNewSaveData()
  applyRuntimeSaveData(data, sampleHeight)
  return data
}

export function installRuntimeAutosave(
  storage: SaveStorage,
  host: AutosaveHost,
  warn?: SaveWarning,
): () => void {
  let lastQuestRevision = getQuestRuntimeSnapshot().questRevision
  let lastCampLeaderDefeated = getQuestRuntimeSnapshot().campLeaderDefeated

  const persist = () => saveRuntimeState(storage, warn)
  const unsubscribe = subscribeQuestRuntime(() => {
    const quest = getQuestRuntimeSnapshot()
    if (
      quest.questRevision === lastQuestRevision &&
      quest.campLeaderDefeated === lastCampLeaderDefeated
    )
      return
    lastQuestRevision = quest.questRevision
    lastCampLeaderDefeated = quest.campLeaderDefeated
    persist()
  })
  const intervalId = host.setInterval(() => {
    const player = playerStore.getState()
    if (player.death.phase === 'Alive' && player.vitals.health > 0) persist()
  }, SAVE_CONFIG.autosaveSeconds * 1_000)
  const onPageHide = () => persist()
  host.addEventListener('pagehide', onPageHide)

  return () => {
    unsubscribe()
    host.clearInterval(intervalId)
    host.removeEventListener('pagehide', onPageHide)
  }
}
