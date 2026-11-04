import { describe, expect, it } from 'vitest'
import { FRAME_SHELTER_KEY } from '../data/quests'
import { ZONE } from '../data/zone'
import {
  campKeyDropFallbackPoint,
  distanceFromKeyDropBlockerEdge,
  formatPendingKeyCompassLabel,
  formatPendingKeyTrackerText,
  getCampKeyDropBlockers,
  isKeyDropPointClear,
  isWithinKeyPickupRadius,
  resolveCampKeyDropPosition,
  resolveKeyDropPoint,
  type KeyDropBlocker,
} from '../game/quest/keyDrop'

const walkable = () => true

describe('frame shelter key drop', () => {
  it('keeps an already clear death point unchanged', () => {
    const point = resolveKeyDropPoint(10, 20, [], walkable)
    expect(point).toEqual({ x: 10, z: 20 })
  })

  it.each([
    {
      label: 'camp fire',
      blocker: { shape: 'circle', x: 380, z: -240, radius: 0.8 } as const,
    },
    ...ZONE.placeholders.camp.tentOffsets.map((offset, index) => ({
      label: `tent ${index + 1}`,
      blocker: {
        shape: 'rectangle' as const,
        x: ZONE.locations.D.center[0] + offset[0],
        z: ZONE.locations.D.center[1] + offset[1],
        halfWidth: ZONE.placeholders.camp.tentSize[0] * 0.5,
        halfDepth: ZONE.placeholders.camp.tentSize[2] * 0.5,
      },
    })),
    {
      label: 'lookout',
      blocker: {
        shape: 'rectangle' as const,
        x: ZONE.locations.D.center[0] + ZONE.placeholders.camp.lookoutOffset[0],
        z: ZONE.locations.D.center[1] + ZONE.placeholders.camp.lookoutOffset[1],
        halfWidth: ZONE.placeholders.camp.lookoutSize[0] * 0.5,
        halfDepth: ZONE.placeholders.camp.lookoutSize[2] * 0.5,
      },
    },
    {
      label: 'large rock',
      blocker: { shape: 'circle', x: 400, z: -250, radius: 2 } as const,
    },
  ])(
    'moves a drop out of $label with the required clearance',
    ({ blocker }) => {
      const blockers: readonly KeyDropBlocker[] = [blocker]
      const point = resolveKeyDropPoint(
        blocker.x,
        blocker.z,
        blockers,
        walkable,
      )
      expect(
        Math.hypot(point.x - blocker.x, point.z - blocker.z),
      ).toBeLessThanOrEqual(FRAME_SHELTER_KEY.drop.searchRadius)
      expect(
        distanceFromKeyDropBlockerEdge(point.x, point.z, blocker),
      ).toBeGreaterThanOrEqual(FRAME_SHELTER_KEY.drop.clearance)
    },
  )

  it('keeps the authored checkpoint-side fallback clear', () => {
    const fallback = campKeyDropFallbackPoint()
    expect(
      isKeyDropPointClear(fallback.x, fallback.z, getCampKeyDropBlockers()),
    ).toBe(true)
  })

  it('resolves a saved or legacy drop that is inside a blocker', () => {
    const fireX =
      ZONE.locations.D.center[0] + ZONE.placeholders.camp.fireOffset[0]
    const fireZ =
      ZONE.locations.D.center[1] + ZONE.placeholders.camp.fireOffset[1]
    const resolved = resolveCampKeyDropPosition({ x: fireX, y: 0, z: fireZ })
    expect(resolved.x === fireX && resolved.z === fireZ).toBe(false)
    expect(
      isKeyDropPointClear(resolved.x, resolved.z, getCampKeyDropBlockers()),
    ).toBe(true)
  })

  it('uses the 2.5 m pickup radius at both sides of the boundary', () => {
    expect(isWithinKeyPickupRadius(2.4, 0, 0, 0)).toBe(true)
    expect(isWithinKeyPickupRadius(2.6, 0, 0, 0)).toBe(false)
  })

  it('formats the pending-key tracker and compass distance', () => {
    expect(formatPendingKeyTrackerText(12.4)).toBe('Take the key (12 m).')
    expect(formatPendingKeyCompassLabel(12.6)).toBe('Key 13 m')
    expect(formatPendingKeyTrackerText(-1)).toBe('Take the key (0 m).')
    expect(formatPendingKeyCompassLabel(-1)).toBe('Key 0 m')
  })
})
