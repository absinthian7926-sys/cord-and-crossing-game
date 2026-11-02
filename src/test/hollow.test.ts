import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZONE } from '../data/zone'
import {
  HOLLOW_GATE_HALF_EXTENTS,
  HOLLOW_LAYOUT,
  HOLLOW_SIDE_BARRIER_CENTER_OFFSET,
  HOLLOW_SIDE_BARRIER_HALF_WIDTH,
  consumeHollowClear,
  createHollowProgress,
  isFinalEncounterSpawnInsideBounds,
  isHollowClearReady,
  isSnagBarrierBlockingPoint,
  markHeelstonePassDone,
  markSnagPulled,
  recordFinalEnemyDefeat,
} from '../game/hollow/hollow'
import {
  getHollowRuntimeSnapshot,
  hydrateHollowRuntime,
  registerHollowClearHandler,
  resetHollowRuntime,
} from '../game/hollow/hollowRuntime'

describe('Crossing Hollow progress', () => {
  beforeEach(() => {
    registerHollowClearHandler(null)
    resetHollowRuntime()
  })
  it('requires a pass, the snag, and all three final enemies', () => {
    const progress = createHollowProgress()
    expect(isHollowClearReady(progress)).toBe(false)
    expect(markHeelstonePassDone(progress)).toBe(true)
    expect(markHeelstonePassDone(progress)).toBe(false)
    expect(markSnagPulled(progress)).toBe(true)
    expect(markSnagPulled(progress)).toBe(false)
    expect(recordFinalEnemyDefeat(progress, 0)).toBe(true)
    expect(recordFinalEnemyDefeat(progress, 0)).toBe(false)
    expect(recordFinalEnemyDefeat(progress, 1)).toBe(true)
    expect(isHollowClearReady(progress)).toBe(false)
    expect(recordFinalEnemyDefeat(progress, 2)).toBe(true)
    expect(isHollowClearReady(progress)).toBe(true)
  })

  it('emits the clear completion once', () => {
    const progress = createHollowProgress()
    progress.heelstonePassDone = true
    progress.snagPulled = true
    progress.encounterDefeated = true
    expect(consumeHollowClear(progress)).toBe(true)
    expect(consumeHollowClear(progress)).toBe(false)
  })

  it('rejects invalid or post-completion enemy indices', () => {
    const progress = createHollowProgress()
    expect(recordFinalEnemyDefeat(progress, -1)).toBe(false)
    expect(recordFinalEnemyDefeat(progress, 3)).toBe(false)
    progress.encounterDefeated = true
    expect(recordFinalEnemyDefeat(progress, 0)).toBe(false)
    expect(consumeHollowClear(progress)).toBe(false)
  })

  it('restores the pulled post exactly 2 m toward arrival', () => {
    hydrateHollowRuntime(false, true, false)
    const snag = getHollowRuntimeSnapshot().snag
    expect(
      Math.hypot(
        snag.postX - ZONE.hollow.snagPost[0],
        snag.postZ - ZONE.hollow.snagPost[1],
      ),
    ).toBeCloseTo(ZONE.hollow.snagDistance)
    expect(
      Math.hypot(
        snag.postX - ZONE.hollow.arrival[0],
        snag.postZ - ZONE.hollow.arrival[2],
      ),
    ).toBeLessThan(
      Math.hypot(
        ZONE.hollow.snagPost[0] - ZONE.hollow.arrival[0],
        ZONE.hollow.snagPost[1] - ZONE.hollow.arrival[2],
      ),
    )
  })

  it('keeps every final encounter spawn inside the Hollow bounds', () => {
    for (
      let index = 0;
      index < HOLLOW_LAYOUT.encounterOffsets.length;
      index += 1
    )
      expect(isFinalEncounterSpawnInsideBounds(index)).toBe(true)
    expect(
      isFinalEncounterSpawnInsideBounds(HOLLOW_LAYOUT.encounterOffsets.length),
    ).toBe(false)
  })

  it('blocks the full cross-Hollow barrier until the 3 m gate opens', () => {
    expect(HOLLOW_GATE_HALF_EXTENTS).toEqual([1.5, 1.5, 0.3])
    expect(
      HOLLOW_SIDE_BARRIER_CENTER_OFFSET + HOLLOW_SIDE_BARRIER_HALF_WIDTH,
    ).toBe(HOLLOW_LAYOUT.size / 2)
    expect(
      HOLLOW_SIDE_BARRIER_CENTER_OFFSET - HOLLOW_SIDE_BARRIER_HALF_WIDTH,
    ).toBe(HOLLOW_LAYOUT.blockedGapWidth / 2)

    const gateZ = HOLLOW_LAYOUT.snagPost[1]
    for (const x of [-59, -2, 0, 2, 59])
      expect(isSnagBarrierBlockingPoint(x, gateZ, false)).toBe(true)
    expect(isSnagBarrierBlockingPoint(0, gateZ, true)).toBe(false)
    expect(isSnagBarrierBlockingPoint(2, gateZ, true)).toBe(true)
    expect(
      isSnagBarrierBlockingPoint(
        0,
        gateZ + HOLLOW_GATE_HALF_EXTENTS[2] + 0.01,
        false,
      ),
    ).toBe(false)
    expect(
      isSnagBarrierBlockingPoint(
        HOLLOW_LAYOUT.bounds.maximumX + 1,
        gateZ,
        false,
      ),
    ).toBe(false)
  })

  it('dispatches a restored clear once when a handler registers', () => {
    hydrateHollowRuntime(true, true, true)
    const handler = vi.fn()
    registerHollowClearHandler(handler)
    registerHollowClearHandler(handler)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
