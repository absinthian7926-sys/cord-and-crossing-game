import { beforeEach, describe, expect, it } from 'vitest'
import { QUEST, type QuestEventType } from '../data/quests'
import {
  chooseHollenDialogue,
  emitQuestEvent,
  getQuestRuntimeSnapshot,
  hydrateQuestRuntime,
  openHollenDialogue,
  resetQuestRuntime,
} from '../game/quest/questRuntime'
import { applyQuestEvent, createQuestState } from '../game/quest/quest'
import {
  createSaveData,
  deserializeSave,
  serializeSave,
} from '../game/save/save'

const events = QUEST.steps.map((step) => step.completionEvent)

function questAt(step: 1 | 2 | 3 | 4 | 5 | 6) {
  let state = createQuestState()
  for (let index = 0; index < step - 1; index += 1) {
    state = applyQuestEvent(state, events[index] as QuestEventType)
  }
  return state
}

describe('M6 report path and tassel reward', () => {
  beforeEach(resetQuestRuntime)

  it('ignores the report event at steps 1 through 5', () => {
    for (let step = 1; step <= 5; step += 1) {
      const quest = questAt(step as 1 | 2 | 3 | 4 | 5)
      hydrateQuestRuntime(quest, step >= 2)
      const before = getQuestRuntimeSnapshot()
      expect(emitQuestEvent('reportedToHollen')).toBe(false)
      expect(getQuestRuntimeSnapshot()).toBe(before)
      expect(getQuestRuntimeSnapshot().tasselEarned).toBe(false)

      expect(openHollenDialogue()).toBe(true)
      const questBeforeChoice = getQuestRuntimeSnapshot().quest
      expect(chooseHollenDialogue('report')).toBe(false)
      expect(getQuestRuntimeSnapshot().quest).toBe(questBeforeChoice)
    }
  })

  it('completes at step 6 and grants the tassel exactly once', () => {
    hydrateQuestRuntime(questAt(6), true)
    expect(openHollenDialogue()).toBe(true)
    expect(chooseHollenDialogue('report')).toBe(true)
    const completed = getQuestRuntimeSnapshot()
    expect(completed.quest.complete).toBe(true)
    expect(completed.tasselEarned).toBe(true)
    expect(completed.questRevision).toBe(1)

    expect(emitQuestEvent('reportedToHollen')).toBe(false)
    expect(getQuestRuntimeSnapshot()).toBe(completed)
    expect(getQuestRuntimeSnapshot().questRevision).toBe(1)
  })

  it('round-trips the completed quest and tassel through v2 save data', () => {
    hydrateQuestRuntime(questAt(6), true)
    emitQuestEvent('reportedToHollen')
    const runtime = getQuestRuntimeSnapshot()
    const data = createSaveData({
      player: {
        health: 100,
        stamina: 100,
        position: { x: 0, y: 8, z: 0 },
      },
      quest: runtime.quest,
      campLeaderDefeated: true,
      world: {
        porticoUnlocked: true,
        currentScene: 'zone',
        hollow: {
          heelstonePassDone: true,
          snagPulled: true,
          encounterDefeated: true,
        },
        tasselEarned: runtime.tasselEarned,
      },
    })
    const loaded = deserializeSave(serializeSave(data)).data
    expect(loaded.quest.complete).toBe(true)
    expect(loaded.world.tasselEarned).toBe(true)
  })
})
