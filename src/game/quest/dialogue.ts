import {
  DIALOGUE_NODES,
  DIALOGUE_NODE_BY_STEP,
  type DialogueNodeId,
} from '../../data/dialogue'
import type { QuestEventType, QuestStepId } from '../../data/quests'

export type DialogueState = {
  currentNodeId: DialogueNodeId | null
}

export type DialogueChoiceResult = {
  state: DialogueState
  event: QuestEventType | null
}

export function createDialogueState(): DialogueState {
  return { currentNodeId: null }
}

export function openDialogueForQuestStep(
  state: DialogueState,
  questStep: QuestStepId,
): DialogueState {
  const nodeId = DIALOGUE_NODE_BY_STEP[questStep]
  if (state.currentNodeId === nodeId) return state
  return { currentNodeId: nodeId }
}

export function closeDialogue(state: DialogueState): DialogueState {
  if (state.currentNodeId === null) return state
  return { currentNodeId: null }
}

export function currentDialogueNode(state: DialogueState) {
  return state.currentNodeId === null
    ? null
    : DIALOGUE_NODES[state.currentNodeId]
}

export function chooseDialogueOption(
  state: DialogueState,
  choiceId: string,
): DialogueChoiceResult {
  const node = currentDialogueNode(state)
  if (node === null) return { state, event: null }

  const choice = node.choices.find((candidate) => candidate.id === choiceId)
  if (choice === undefined) return { state, event: null }

  const nextState: DialogueState = choice.close
    ? { currentNodeId: null }
    : { currentNodeId: choice.nextNodeId ?? state.currentNodeId }

  return {
    state: nextState,
    event: 'event' in choice ? (choice.event ?? null) : null,
  }
}
