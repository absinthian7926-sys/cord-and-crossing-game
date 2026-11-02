import { describe, expect, it } from 'vitest'
import { DIALOGUE_NODES, DIALOGUE_NODE_BY_STEP } from '../data/dialogue'
import { QUEST_UI, type QuestStepId } from '../data/quests'
import {
  chooseDialogueOption,
  closeDialogue,
  createDialogueState,
  currentDialogueNode,
  openDialogueForQuestStep,
} from '../game/quest/dialogue'

const wordCount = (line: string) => line.trim().split(/\s+/).length

describe('Hollen dialogue data', () => {
  it('keeps every line short, plain, and free of em dashes', () => {
    for (const node of Object.values(DIALOGUE_NODES)) {
      expect(wordCount(node.text)).toBeLessThan(40)
      expect(node.text).not.toContain('\u2014')
      for (const choice of node.choices) {
        expect(wordCount(choice.label)).toBeLessThan(40)
        expect(choice.label).not.toContain('\u2014')
      }
    }
  })

  it('has 2 to 4 choices and a keyed node for every quest step', () => {
    for (let step = 1; step <= 6; step += 1) {
      const nodeId = DIALOGUE_NODE_BY_STEP[step as QuestStepId]
      const node = DIALOGUE_NODES[nodeId]
      expect(node.questStep).toBe(step)
      expect(node.choices.length).toBeGreaterThanOrEqual(
        QUEST_UI.dialogue.minimumChoices,
      )
      expect(node.choices.length).toBeLessThanOrEqual(
        QUEST_UI.dialogue.maximumChoices,
      )
    }
  })
})

describe('dialogue graph walker', () => {
  it('opens the node keyed to the current quest step', () => {
    const closed = createDialogueState()
    expect(currentDialogueNode(closed)).toBeNull()
    const open = openDialogueForQuestStep(closed, 2)
    expect(currentDialogueNode(open)).toBe(DIALOGUE_NODES['hollen-step-2'])
    expect(openDialogueForQuestStep(open, 2)).toBe(open)
  })

  it('emits the step 1, step 3, and step 6 dialogue events', () => {
    const cases = [
      [1, 'accept', 'talkedToHollen'],
      [3, 'understand', 'returnedToHollen'],
      [6, 'report', 'reportedToHollen'],
    ] as const

    for (const [step, choice, event] of cases) {
      const open = openDialogueForQuestStep(createDialogueState(), step)
      const result = chooseDialogueOption(open, choice)
      expect(result.event).toBe(event)
      expect(result.state.currentNodeId).toBeNull()
    }
  })

  it('walks to a next node and closes without an event', () => {
    const open = openDialogueForQuestStep(createDialogueState(), 3)
    const repeated = chooseDialogueOption(open, 'repeat')
    expect(repeated.event).toBeNull()
    expect(repeated.state.currentNodeId).toBe('hollen-step-3')

    const closed = closeDialogue(repeated.state)
    expect(closed.currentNodeId).toBeNull()
    expect(closeDialogue(closed)).toBe(closed)
  })

  it('ignores missing choices and choices while closed', () => {
    const closed = createDialogueState()
    const closedResult = chooseDialogueOption(closed, 'accept')
    expect(closedResult).toEqual({ state: closed, event: null })

    const open = openDialogueForQuestStep(closed, 1)
    const missingResult = chooseDialogueOption(open, 'missing')
    expect(missingResult).toEqual({ state: open, event: null })
  })
})
