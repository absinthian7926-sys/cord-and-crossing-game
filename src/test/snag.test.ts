import { describe, expect, it } from 'vitest'
import { ZONE } from '../data/zone'
import {
  beginSnagPull,
  createSnagState,
  MARKED_SNAG_POST_ID,
  SNAG_PULL_DISTANCE,
  stepSnag,
} from '../game/hollow/snag'

describe('Hollow snag post', () => {
  it('uses the typed zone pull distance', () => {
    expect(SNAG_PULL_DISTANCE).toBe(ZONE.hollow.snagDistance)
  })

  it('pulls the marked post exactly 2 m toward the player', () => {
    const state = createSnagState(0, -30)
    expect(beginSnagPull(state, MARKED_SNAG_POST_ID, 0, 0, 1, 1)).toBe(true)
    expect(stepSnag(state, 1)).toBe(false)
    expect(state.postZ).toBeCloseTo(-29)
    expect(stepSnag(state, 1)).toBe(true)
    expect(state.postZ).toBeCloseTo(-30 + SNAG_PULL_DISTANCE)
    expect(state.pulled).toBe(true)
  })

  it('ignores casts that do not hit the marked post', () => {
    const state = createSnagState(0, -30)
    expect(beginSnagPull(state, 'ground', 0, 0, 1, 1)).toBe(false)
    expect(stepSnag(state, 1)).toBe(false)
    expect(state.postZ).toBe(-30)
  })

  it('uses the pull multiplier for speed but not distance', () => {
    const plain = createSnagState(0, -30)
    const carried = createSnagState(0, -30)
    beginSnagPull(plain, MARKED_SNAG_POST_ID, 0, 0, 1, 1)
    beginSnagPull(carried, MARKED_SNAG_POST_ID, 0, 0, 1, 2)
    expect(stepSnag(plain, 1)).toBe(false)
    expect(stepSnag(carried, 1)).toBe(true)
    expect(plain.postZ).toBeCloseTo(-29)
    expect(carried.postZ).toBeCloseTo(-28)
  })

  it('rejects invalid or duplicate pulls', () => {
    const state = createSnagState(0, -30)
    expect(beginSnagPull(state, MARKED_SNAG_POST_ID, 0, -30, 1, 1)).toBe(false)
    expect(beginSnagPull(state, MARKED_SNAG_POST_ID, 0, 0, 0, 1)).toBe(false)
    expect(beginSnagPull(state, MARKED_SNAG_POST_ID, 0, 0, 1, 0)).toBe(false)
    expect(beginSnagPull(state, MARKED_SNAG_POST_ID, 0, 0, 1, 1)).toBe(true)
    expect(beginSnagPull(state, MARKED_SNAG_POST_ID, 0, 0, 1, 1)).toBe(false)
    stepSnag(state, 2)
    expect(beginSnagPull(state, MARKED_SNAG_POST_ID, 0, 0, 1, 1)).toBe(false)
    expect(stepSnag(state, 0)).toBe(false)
  })
})
