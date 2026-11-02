import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chooseHollenDialogue,
  closeHollenDialogue,
  emitQuestEvent,
  getQuestRuntimeSnapshot,
  hydrateQuestRuntime,
  isHollenNearby,
  isKeyNearby,
  lootFrameShelterKey,
  markCampLeaderDefeated,
  openHollenDialogue,
  resetQuestRuntime,
  restorePendingKeyDrop,
  setHollenNearby,
  setHollenNearbyTransient,
  setKeyNearby,
  setKeyNearbyTransient,
  subscribeQuestRuntime,
  toggleQuestLog,
} from '../game/quest/questRuntime'
import { applyQuestEvent, createQuestState } from '../game/quest/quest'

describe('quest runtime', () => {
  beforeEach(resetQuestRuntime)

  it('publishes stable snapshots only when event state changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeQuestRuntime(listener)
    const initial = getQuestRuntimeSnapshot()
    setHollenNearby(false)
    expect(getQuestRuntimeSnapshot()).toBe(initial)
    expect(listener).not.toHaveBeenCalled()

    setHollenNearby(true)
    expect(getQuestRuntimeSnapshot().hollenNearby).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('tracks frame proximity in place without publishing a snapshot', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeQuestRuntime(listener)
    const initial = getQuestRuntimeSnapshot()

    setHollenNearbyTransient(true)
    setKeyNearbyTransient(true)

    expect(isHollenNearby()).toBe(true)
    expect(isKeyNearby()).toBe(true)
    expect(getQuestRuntimeSnapshot()).toBe(initial)
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('uses the latest transient proximity when a sensor exit is delayed', () => {
    setHollenNearby(true)
    setKeyNearby(true)
    setHollenNearbyTransient(false)
    setKeyNearbyTransient(false)

    expect(getQuestRuntimeSnapshot()).toMatchObject({
      hollenNearby: true,
      keyNearby: true,
    })
    expect(isHollenNearby()).toBe(false)
    expect(isKeyNearby()).toBe(false)
  })

  it('walks dialogue and advances only the matching quest event', () => {
    expect(openHollenDialogue()).toBe(true)
    expect(getQuestRuntimeSnapshot().dialogue.currentNodeId).toBe(
      'hollen-step-1',
    )
    expect(chooseHollenDialogue('missing')).toBe(false)
    expect(chooseHollenDialogue('accept')).toBe(true)
    expect(getQuestRuntimeSnapshot().quest.currentStep).toBe(2)
    expect(getQuestRuntimeSnapshot().questRevision).toBe(1)
    expect(getQuestRuntimeSnapshot().dialogue.currentNodeId).toBeNull()
    expect(emitQuestEvent('talkedToHollen')).toBe(false)
    expect(closeHollenDialogue()).toBe(false)
  })

  it('tracks UI state without incrementing the quest revision', () => {
    toggleQuestLog()
    setHollenNearby(true)
    expect(getQuestRuntimeSnapshot()).toMatchObject({
      questLogOpen: true,
      hollenNearby: true,
      questRevision: 0,
    })
  })

  it('drops and loots the key through the strict step 2 event', () => {
    emitQuestEvent('talkedToHollen')
    expect(markCampLeaderDefeated({ x: 4, y: 3, z: 2 })).toBe(true)
    expect(getQuestRuntimeSnapshot().keyDrop).toEqual({ x: 4, y: 3, z: 2 })
    expect(lootFrameShelterKey()).toBe(false)
    setKeyNearby(true)
    expect(lootFrameShelterKey()).toBe(true)
    expect(getQuestRuntimeSnapshot().quest.currentStep).toBe(3)
    expect(getQuestRuntimeSnapshot().quest.keyLooted).toBe(true)
    expect(getQuestRuntimeSnapshot().keyDrop).toBeNull()
    expect(getQuestRuntimeSnapshot().keyNearby).toBe(false)
  })

  it('hydrates a pending drop and restores a fallback position once', () => {
    let quest = createQuestState()
    quest = applyQuestEvent(quest, 'talkedToHollen')
    hydrateQuestRuntime(quest, true)
    expect(restorePendingKeyDrop({ x: 1, y: 2, z: 3 })).toBe(true)
    expect(restorePendingKeyDrop({ x: 5, y: 6, z: 7 })).toBe(false)
    expect(getQuestRuntimeSnapshot().keyDrop).toEqual({ x: 1, y: 2, z: 3 })
  })
})
