import { describe, expect, it } from 'vitest'
import { CAMP_LEADER } from '../data/enemies'
import {
  FRAME_SHELTER_KEY,
  HOLLEN,
  QUEST,
  QUEST_STEPS,
  SAVE_CONFIG,
} from '../data/quests'

describe('quest data', () => {
  it('defines The Line at the Rise with all six GDD steps', () => {
    expect(QUEST.id).toBe('the-line-at-the-rise')
    expect(QUEST.name).toBe('The Line at the Rise')
    expect(QUEST.steps).toBe(QUEST_STEPS)
    expect(QUEST_STEPS).toHaveLength(6)
    expect(QUEST_STEPS.map((step) => step.order)).toEqual([1, 2, 3, 4, 5, 6])
    expect(QUEST_STEPS.map((step) => step.completionEvent)).toEqual([
      'talkedToHollen',
      'keyLooted',
      'returnedToHollen',
      'crossedPortico',
      'hollowCleared',
      'reportedToHollen',
    ])
  })

  it('matches the Hollen, key, and camp leader quest facts', () => {
    expect(HOLLEN.name).toBe('Hollen')
    expect(HOLLEN.position).toEqual([-5, 5])
    expect(HOLLEN.interactionRadius).toBe(2.5)
    expect(FRAME_SHELTER_KEY.name).toBe('frame shelter key')
    expect(FRAME_SHELTER_KEY.pickupRadius).toBe(1.5)
    expect(FRAME_SHELTER_KEY.prompt).toBe('E Take key')
    expect(CAMP_LEADER.maxHealth).toBe(120)
    expect(CAMP_LEADER.scale).toBe(1.15)
    expect(CAMP_LEADER.campOffset).toEqual([0, 4])
  })

  it('keeps save defaults in typed data', () => {
    expect(SAVE_CONFIG).toEqual({
      storageKey: 'cord-and-crossing.save.v1',
      schemaVersion: 1,
      autosaveSeconds: 30,
      playerName: 'Runner',
    })
  })
})
