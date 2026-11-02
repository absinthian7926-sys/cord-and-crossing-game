import { QUEST, type QuestEventType, type QuestStepId } from '../../data/quests'

export type QuestState = {
  currentStep: QuestStepId
  completedSteps: readonly QuestStepId[]
  keyLooted: boolean
  complete: boolean
}

export function createQuestState(): QuestState {
  return {
    currentStep: 1,
    completedSteps: [],
    keyLooted: false,
    complete: false,
  }
}

export function isQuestStepId(value: unknown): value is QuestStepId {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= QUEST.steps.length
  )
}

export function applyQuestEvent(
  state: QuestState,
  event: QuestEventType,
): QuestState {
  if (state.complete) return state

  const step = QUEST.steps[state.currentStep - 1]
  if (step.completionEvent !== event) return state

  const completedSteps = [...state.completedSteps, state.currentStep]
  const keyLooted = state.keyLooted || event === 'keyLooted'

  if (state.currentStep === QUEST.steps.length) {
    return {
      currentStep: state.currentStep,
      completedSteps,
      keyLooted,
      complete: true,
    }
  }

  return {
    currentStep: (state.currentStep + 1) as QuestStepId,
    completedSteps,
    keyLooted,
    complete: false,
  }
}

export function currentQuestStep(state: QuestState) {
  return QUEST.steps[state.currentStep - 1]
}
