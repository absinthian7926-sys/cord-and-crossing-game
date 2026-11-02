import type { QuestEventType, QuestStepId } from './quests'

export type DialogueNodeId =
  | 'hollen-step-1'
  | 'hollen-step-2'
  | 'hollen-step-3'
  | 'hollen-step-4'
  | 'hollen-step-5'
  | 'hollen-step-6'

export type DialogueChoice = {
  id: string
  label: string
  nextNodeId?: DialogueNodeId
  event?: QuestEventType
  close: boolean
}

export type DialogueNode = {
  id: DialogueNodeId
  speaker: 'Hollen'
  questStep: QuestStepId
  text: string
  choices: readonly DialogueChoice[]
}

export const DIALOGUE_NODES = {
  'hollen-step-1': {
    id: 'hollen-step-1',
    speaker: 'Hollen',
    questStep: 1,
    // PLACEHOLDER: M5 dialogue line.
    text: 'Brigands took the iron ring keys for the old frame shelter at the rise.',
    choices: [
      {
        id: 'accept',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'I will bring one back.',
        event: 'talkedToHollen',
        close: true,
      },
      {
        id: 'leave',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'Leave',
        close: true,
      },
    ],
  },
  'hollen-step-2': {
    id: 'hollen-step-2',
    speaker: 'Hollen',
    questStep: 2,
    // PLACEHOLDER: M5 dialogue line.
    text: 'The frame shelter key is at the brigand camp.',
    choices: [
      {
        id: 'acknowledge',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'I am looking for it.',
        close: true,
      },
      {
        id: 'leave',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'Leave',
        close: true,
      },
    ],
  },
  'hollen-step-3': {
    id: 'hollen-step-3',
    speaker: 'Hollen',
    questStep: 3,
    // PLACEHOLDER: M5 dialogue line.
    text: 'Once you carry an effect, press F to clear the line through the heelstones.',
    choices: [
      {
        id: 'understand',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'I understand.',
        event: 'returnedToHollen',
        close: true,
      },
      {
        id: 'repeat',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'Say that again.',
        nextNodeId: 'hollen-step-3',
        close: false,
      },
      {
        id: 'leave',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'Leave',
        close: true,
      },
    ],
  },
  'hollen-step-4': {
    id: 'hollen-step-4',
    speaker: 'Hollen',
    questStep: 4,
    // PLACEHOLDER: M5 dialogue line.
    text: 'Take the key to the Ruin Shelf and cross the portico screen.',
    choices: [
      {
        id: 'acknowledge',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'I will go to the shelf.',
        close: true,
      },
      {
        id: 'leave',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'Leave',
        close: true,
      },
    ],
  },
  'hollen-step-5': {
    id: 'hollen-step-5',
    speaker: 'Hollen',
    questStep: 5,
    // PLACEHOLDER: M5 dialogue line.
    text: 'Clear the line, snag the rope post, and defeat the final encounter in the Hollow.',
    choices: [
      {
        id: 'acknowledge',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'I know the work.',
        close: true,
      },
      {
        id: 'leave',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'Leave',
        close: true,
      },
    ],
  },
  'hollen-step-6': {
    id: 'hollen-step-6',
    speaker: 'Hollen',
    questStep: 6,
    // PLACEHOLDER: M5 dialogue line.
    text: 'Report when you return through the screen.',
    choices: [
      {
        id: 'report',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'The work is finished.',
        event: 'reportedToHollen',
        close: true,
      },
      {
        id: 'leave',
        // PLACEHOLDER: M5 dialogue choice.
        label: 'Leave',
        close: true,
      },
    ],
  },
} as const satisfies Record<DialogueNodeId, DialogueNode>

export const DIALOGUE_NODE_BY_STEP = {
  1: 'hollen-step-1',
  2: 'hollen-step-2',
  3: 'hollen-step-3',
  4: 'hollen-step-4',
  5: 'hollen-step-5',
  6: 'hollen-step-6',
} as const satisfies Record<QuestStepId, DialogueNodeId>
