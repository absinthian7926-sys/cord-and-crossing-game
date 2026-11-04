import type { QuestEventType } from '../../data/quests'
import { ENEMY_SPAWNS } from '../../data/enemies'
import {
  addDeadCampEnemyId,
  removeDeadCampEnemyId,
  shouldHoldCampRespawn,
  shouldSetCampCheckpoint,
} from '../enemies/campProgress'
import {
  chooseDialogueOption,
  closeDialogue,
  createDialogueState,
  openDialogueForQuestStep,
  type DialogueState,
} from './dialogue'
import { applyQuestEvent, createQuestState, type QuestState } from './quest'

export type KeyDropPosition = {
  readonly x: number
  readonly y: number
  readonly z: number
}

export type QuestRuntimeSnapshot = {
  readonly quest: QuestState
  readonly dialogue: DialogueState
  readonly questLogOpen: boolean
  readonly hollenNearby: boolean
  readonly keyNearby: boolean
  readonly campLeaderDefeated: boolean
  readonly keyDrop: KeyDropPosition | null
  readonly campCheckpointActive: boolean
  readonly deadCampEnemyIds: readonly string[]
  readonly tasselEarned: boolean
  readonly questRevision: number
}

type QuestRuntimeListener = () => void

const listeners = new Set<QuestRuntimeListener>()
const transientProximity = {
  hollenNearby: false,
  keyNearby: false,
}

function initialSnapshot(): QuestRuntimeSnapshot {
  return {
    quest: createQuestState(),
    dialogue: createDialogueState(),
    questLogOpen: false,
    hollenNearby: false,
    keyNearby: false,
    campLeaderDefeated: false,
    keyDrop: null,
    campCheckpointActive: false,
    deadCampEnemyIds: [],
    tasselEarned: false,
    questRevision: 0,
  }
}

let snapshot = initialSnapshot()

function publish(next: QuestRuntimeSnapshot): void {
  if (next === snapshot) return
  snapshot = next
  for (const listener of listeners) listener()
}

function copyQuestState(quest: QuestState): QuestState {
  return {
    currentStep: quest.currentStep,
    completedSteps: [...quest.completedSteps],
    keyLooted: quest.keyLooted,
    complete: quest.complete,
  }
}

export function getQuestRuntimeSnapshot(): QuestRuntimeSnapshot {
  return snapshot
}

export function subscribeQuestRuntime(
  listener: QuestRuntimeListener,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetQuestRuntime(): void {
  transientProximity.hollenNearby = false
  transientProximity.keyNearby = false
  publish(initialSnapshot())
}

export function hydrateQuestRuntime(
  quest: QuestState,
  campLeaderDefeated: boolean,
  keyDrop: KeyDropPosition | null = null,
  tasselEarned = false,
  campCheckpointActive = false,
  deadCampEnemyIds: readonly string[] = [],
): void {
  transientProximity.hollenNearby = false
  transientProximity.keyNearby = false
  publish({
    quest: copyQuestState(quest),
    dialogue: createDialogueState(),
    questLogOpen: false,
    hollenNearby: false,
    keyNearby: false,
    campLeaderDefeated,
    keyDrop:
      campLeaderDefeated && !quest.keyLooted && keyDrop !== null
        ? { ...keyDrop }
        : null,
    campCheckpointActive:
      quest.currentStep === 2 && !quest.keyLooted && campCheckpointActive,
    deadCampEnemyIds: [...deadCampEnemyIds],
    tasselEarned: quest.complete && tasselEarned,
    questRevision: 0,
  })
}

function questProgressForEvent(event: QuestEventType): {
  quest: QuestState
  tasselEarned: boolean
} | null {
  const nextQuest = applyQuestEvent(snapshot.quest, event)
  if (nextQuest === snapshot.quest) return null
  return {
    quest: nextQuest,
    tasselEarned: snapshot.tasselEarned || event === 'reportedToHollen',
  }
}

export function emitQuestEvent(event: QuestEventType): boolean {
  const progress = questProgressForEvent(event)
  if (progress === null) return false
  publish({
    ...snapshot,
    quest: progress.quest,
    tasselEarned: progress.tasselEarned,
    keyNearby: event === 'keyLooted' ? false : snapshot.keyNearby,
    keyDrop: event === 'keyLooted' ? null : snapshot.keyDrop,
    campCheckpointActive:
      event === 'keyLooted' ? false : snapshot.campCheckpointActive,
    questRevision: snapshot.questRevision + 1,
  })
  if (event === 'keyLooted') transientProximity.keyNearby = false
  return true
}

export function setHollenNearby(nearby: boolean): void {
  transientProximity.hollenNearby = nearby
  if (snapshot.hollenNearby === nearby) return
  publish({ ...snapshot, hollenNearby: nearby })
}

export function setKeyNearby(nearby: boolean): void {
  transientProximity.keyNearby = nearby
  if (snapshot.keyNearby === nearby) return
  publish({ ...snapshot, keyNearby: nearby })
}

export function setHollenNearbyTransient(nearby: boolean): void {
  transientProximity.hollenNearby = nearby
}

export function setKeyNearbyTransient(nearby: boolean): void {
  transientProximity.keyNearby = nearby
}

export function isHollenNearby(): boolean {
  return transientProximity.hollenNearby
}

export function isKeyNearby(): boolean {
  return transientProximity.keyNearby
}

export function openHollenDialogue(): boolean {
  const dialogue = openDialogueForQuestStep(
    snapshot.dialogue,
    snapshot.quest.currentStep,
    snapshot.quest.complete,
  )
  if (dialogue === snapshot.dialogue) return false
  publish({ ...snapshot, dialogue, questLogOpen: false })
  return true
}

export function closeHollenDialogue(): boolean {
  const dialogue = closeDialogue(snapshot.dialogue)
  if (dialogue === snapshot.dialogue) return false
  publish({ ...snapshot, dialogue })
  return true
}

export function chooseHollenDialogue(choiceId: string): boolean {
  const result = chooseDialogueOption(snapshot.dialogue, choiceId)
  const progress =
    result.event === null ? null : questProgressForEvent(result.event)
  if (result.state === snapshot.dialogue && progress === null) return false
  publish({
    ...snapshot,
    dialogue: result.state,
    quest: progress?.quest ?? snapshot.quest,
    tasselEarned: progress?.tasselEarned ?? snapshot.tasselEarned,
    questRevision:
      progress !== null ? snapshot.questRevision + 1 : snapshot.questRevision,
  })
  return true
}

export function setQuestLogOpen(open: boolean): void {
  if (snapshot.questLogOpen === open) return
  publish({ ...snapshot, questLogOpen: open })
}

export function toggleQuestLog(): void {
  setQuestLogOpen(!snapshot.questLogOpen)
}

export function trySetCampCheckpoint(
  playerX: number,
  playerZ: number,
): boolean {
  if (snapshot.campCheckpointActive) return false
  const distanceToCamp = Math.hypot(
    playerX - ENEMY_SPAWNS.camp.anchor[0],
    playerZ - ENEMY_SPAWNS.camp.anchor[1],
  )
  if (
    !shouldSetCampCheckpoint(
      snapshot.quest.currentStep,
      snapshot.quest.keyLooted,
      distanceToCamp,
    )
  )
    return false
  publish({
    ...snapshot,
    campCheckpointActive: true,
    questRevision: snapshot.questRevision + 1,
  })
  return true
}

export function markCampEnemyDead(enemyId: string): boolean {
  if (
    !shouldHoldCampRespawn(
      enemyId,
      snapshot.quest.currentStep,
      snapshot.quest.keyLooted,
    )
  )
    return false
  const deadCampEnemyIds = addDeadCampEnemyId(
    snapshot.deadCampEnemyIds,
    enemyId,
  )
  if (deadCampEnemyIds === snapshot.deadCampEnemyIds) return false
  publish({
    ...snapshot,
    deadCampEnemyIds,
    questRevision: snapshot.questRevision + 1,
  })
  return true
}

export function markCampEnemyRespawned(enemyId: string): boolean {
  const deadCampEnemyIds = removeDeadCampEnemyId(
    snapshot.deadCampEnemyIds,
    enemyId,
  )
  if (deadCampEnemyIds === snapshot.deadCampEnemyIds) return false
  publish({
    ...snapshot,
    deadCampEnemyIds,
    questRevision: snapshot.questRevision + 1,
  })
  return true
}

export function isCampEnemyRespawnHeld(enemyId: string): boolean {
  for (let index = 0; index < snapshot.deadCampEnemyIds.length; index += 1) {
    if (snapshot.deadCampEnemyIds[index] === enemyId)
      return snapshot.quest.currentStep === 2 && !snapshot.quest.keyLooted
  }
  return false
}

export function markCampLeaderDefeated(position: KeyDropPosition): boolean {
  if (snapshot.quest.keyLooted) return false
  const unchanged =
    snapshot.campLeaderDefeated &&
    snapshot.keyDrop?.x === position.x &&
    snapshot.keyDrop.y === position.y &&
    snapshot.keyDrop.z === position.z
  if (unchanged) return false
  publish({
    ...snapshot,
    campLeaderDefeated: true,
    keyDrop: { ...position },
    keyNearby: false,
    questRevision: snapshot.questRevision + 1,
  })
  transientProximity.keyNearby = false
  return true
}

export function restorePendingKeyDrop(position: KeyDropPosition): boolean {
  if (
    !snapshot.campLeaderDefeated ||
    snapshot.quest.keyLooted ||
    snapshot.keyDrop !== null
  )
    return false
  publish({
    ...snapshot,
    keyDrop: { ...position },
    questRevision: snapshot.questRevision + 1,
  })
  return true
}

export function lootFrameShelterKey(): boolean {
  if (!isKeyNearby() || snapshot.keyDrop === null) return false
  return emitQuestEvent('keyLooted')
}
