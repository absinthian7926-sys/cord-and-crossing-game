export const QUEST_EVENT_TYPES = {
  talkedToHollen: 'talkedToHollen',
  keyLooted: 'keyLooted',
  returnedToHollen: 'returnedToHollen',
  crossedPortico: 'crossedPortico',
  hollowCleared: 'hollowCleared',
  reportedToHollen: 'reportedToHollen',
} as const

export type QuestEventType =
  (typeof QUEST_EVENT_TYPES)[keyof typeof QUEST_EVENT_TYPES]

export type QuestStepId = 1 | 2 | 3 | 4 | 5 | 6

export type QuestStepDefinition = {
  id: string
  order: QuestStepId
  trackerText: string
  completionEvent: QuestEventType
}

export const QUEST_STEPS = [
  {
    id: 'talk-to-hollen',
    order: 1,
    trackerText: 'Talk to Hollen.',
    completionEvent: QUEST_EVENT_TYPES.talkedToHollen,
  },
  {
    id: 'take-frame-shelter-key',
    order: 2,
    trackerText: 'Clear the brigand camp and take the frame shelter key.',
    completionEvent: QUEST_EVENT_TYPES.keyLooted,
  },
  {
    id: 'return-to-hollen',
    order: 3,
    trackerText: 'Return to Hollen.',
    completionEvent: QUEST_EVENT_TYPES.returnedToHollen,
  },
  {
    id: 'cross-portico-screen',
    order: 4,
    trackerText:
      'Go to the Ruin Shelf, use the key, and cross the portico screen.',
    completionEvent: QUEST_EVENT_TYPES.crossedPortico,
  },
  {
    id: 'clear-crossing-hollow',
    order: 5,
    trackerText:
      'Clear the line, snag the rope post, and defeat the final encounter.',
    completionEvent: QUEST_EVENT_TYPES.hollowCleared,
  },
  {
    id: 'report-to-hollen',
    order: 6,
    trackerText: 'Return through the screen and report to Hollen.',
    completionEvent: QUEST_EVENT_TYPES.reportedToHollen,
  },
] as const satisfies readonly QuestStepDefinition[]

export const QUEST = {
  id: 'the-line-at-the-rise',
  name: 'The Line at the Rise',
  steps: QUEST_STEPS,
} as const

export const FRAME_SHELTER_KEY = {
  id: 'frame-shelter-key',
  name: 'frame shelter key',
  pickupRadius: 1.5,
  // PLACEHOLDER: M5 key pickup prompt.
  prompt: 'E Take key',
  // PLACEHOLDER: M5 key mesh and glow.
  presentation: {
    ringRadius: 0.18,
    tubeRadius: 0.035,
    radialSegments: 6,
    tubularSegments: 16,
    color: '#5d5a50',
    metalness: 0.65,
    roughness: 0.5,
    glowColor: '#c9a46a',
    glowIntensity: 0.4,
    glowRange: 2,
  },
} as const

export const KEY_ITEM = FRAME_SHELTER_KEY

export const TASSEL_REWARD = {
  id: 'dyed-cloth-tassel',
  length: 0.25,
  width: 0.06,
  depth: 0.025,
  color: '#9f493e',
  offset: [0, -0.56, 0],
  roughness: 0.9,
} as const

export const HOLLEN = {
  name: 'Hollen',
  position: [-5, 5],
  facingTarget: [0, 0],
  // PLACEHOLDER: M5 capsule body.
  body: {
    radius: 0.4,
    height: 1.8,
    color: '#b8aa82',
  },
  interactionRadius: 2.5,
  prompt: 'E Talk',
} as const

export const QUEST_UI = {
  dialogue: {
    maxWidthPixels: 640,
    parchmentColor: '#e8dcc0',
    inkColor: '#2b2620',
    minimumChoices: 2,
    maximumChoices: 4,
  },
  tracker: {
    fontSizePixels: 14,
    highlightSeconds: 3,
  },
  questLog: {
    keySlots: 1,
  },
} as const

export const SAVE_CONFIG = {
  storageKey: 'cord-and-crossing.save.v2',
  legacyStorageKey: 'cord-and-crossing.save.v1',
  schemaVersion: 2,
  autosaveSeconds: 30,
  playerName: 'Runner',
} as const
