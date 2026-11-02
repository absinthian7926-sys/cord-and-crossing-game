import { describe, expect, it } from 'vitest'
import { QUEST, type QuestEventType } from '../data/quests'
import {
  applyQuestEvent,
  createQuestState,
  currentQuestStep,
  isQuestStepId,
} from '../game/quest/quest'

describe('quest progression', () => {
  it('starts at step 1 with no completed steps or key', () => {
    const state = createQuestState()
    expect(state).toEqual({
      currentStep: 1,
      completedSteps: [],
      keyLooted: false,
      complete: false,
    })
    expect(currentQuestStep(state)).toBe(QUEST.steps[0])
  })

  it('advances all six events strictly in order', () => {
    const events: QuestEventType[] = [
      'talkedToHollen',
      'keyLooted',
      'returnedToHollen',
      'crossedPortico',
      'hollowCleared',
      'reportedToHollen',
    ]
    let state = createQuestState()

    for (let index = 0; index < events.length; index += 1) {
      state = applyQuestEvent(state, events[index])
      expect(state.completedSteps).toEqual(
        Array.from({ length: index + 1 }, (_, stepIndex) => stepIndex + 1),
      )
      expect(state.keyLooted).toBe(index >= 1)
      expect(state.currentStep).toBe(Math.min(index + 2, 6))
      expect(state.complete).toBe(index === 5)
    }
  })

  it('returns the same state for out-of-order and repeated events', () => {
    const initial = createQuestState()
    expect(applyQuestEvent(initial, 'keyLooted')).toBe(initial)

    const stepTwo = applyQuestEvent(initial, 'talkedToHollen')
    expect(applyQuestEvent(stepTwo, 'talkedToHollen')).toBe(stepTwo)
    expect(applyQuestEvent(stepTwo, 'returnedToHollen')).toBe(stepTwo)
  })

  it('does not change a completed quest', () => {
    let state = createQuestState()
    for (const step of QUEST.steps) {
      state = applyQuestEvent(state, step.completionEvent)
    }
    expect(applyQuestEvent(state, 'reportedToHollen')).toBe(state)
  })

  it('recognizes only integer step identifiers from 1 through 6', () => {
    expect(isQuestStepId(1)).toBe(true)
    expect(isQuestStepId(6)).toBe(true)
    expect(isQuestStepId('1')).toBe(false)
    expect(isQuestStepId(1.5)).toBe(false)
    expect(isQuestStepId(0)).toBe(false)
    expect(isQuestStepId(7)).toBe(false)
  })
})
