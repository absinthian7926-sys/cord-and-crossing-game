import type { QuestEventType } from '../../data/quests'
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
    questRevision: 0,
  })
}

export function emitQuestEvent(event: QuestEventType): boolean {
  const nextQuest = applyQuestEvent(snapshot.quest, event)
  if (nextQuest === snapshot.quest) return false
  publish({
    ...snapshot,
    quest: nextQuest,
    keyNearby: event === 'keyLooted' ? false : snapshot.keyNearby,
    keyDrop: event === 'keyLooted' ? null : snapshot.keyDrop,
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
  const quest = result.event
    ? applyQuestEvent(snapshot.quest, result.event)
    : snapshot.quest
  if (result.state === snapshot.dialogue && quest === snapshot.quest)
    return false
  const questChanged = quest !== snapshot.quest
  publish({
    ...snapshot,
    dialogue: result.state,
    quest,
    questRevision: questChanged
      ? snapshot.questRevision + 1
      : snapshot.questRevision,
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
  publish({ ...snapshot, keyDrop: { ...position } })
  return true
}

export function lootFrameShelterKey(): boolean {
  if (!isKeyNearby() || snapshot.keyDrop === null) return false
  return emitQuestEvent('keyLooted')
}
