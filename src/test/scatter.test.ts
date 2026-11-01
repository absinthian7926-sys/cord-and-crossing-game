import { describe, expect, it } from 'vitest'
import { ZONE } from '../data/zone'
import { distanceToRoad } from '../game/world/road'
import {
  createScatterBuffer,
  fillScatter,
  generateScatter,
  isInsideLocationFootprint,
  isScatterPointAllowed,
  scatterCountForQuality,
} from '../game/world/scatter'

describe('Saltwind Rise scatter', () => {
  it('is deterministic for the same seed and caller-owned buffers', () => {
    const first = fillScatter(createScatterBuffer(128), 'rocks', 41)
    const second = fillScatter(createScatterBuffer(128), 'rocks', 41)
    expect(Array.from(first.positions)).toEqual(Array.from(second.positions))
    expect(Array.from(first.scales)).toEqual(Array.from(second.scales))
    expect(Array.from(first.rotations)).toEqual(Array.from(second.rotations))
    expect(Array.from(first.variants)).toEqual(Array.from(second.variants))
  })

  it('uses the exact Medium counts', () => {
    const rocks = generateScatter('rocks', 'Medium')
    const scrub = generateScatter('scrub', 'Medium')
    expect(rocks.count).toBe(scatterCountForQuality('rocks', 'Medium'))
    expect(scrub.count).toBe(scatterCountForQuality('scrub', 'Medium'))
    expect(rocks.count).toBe(ZONE.scatter.mediumCounts.rocks)
    expect(scrub.count).toBe(ZONE.scatter.mediumCounts.scrub)
  })

  it('rejects road, sea, safe-zone and location footprint points', () => {
    expect(isScatterPointAllowed(0, 0)).toBe(false)
    expect(isScatterPointAllowed(ZONE.bounds.minimumX, 200)).toBe(false)
    expect(isScatterPointAllowed(300, -55)).toBe(false)
    expect(isScatterPointAllowed(380, -240)).toBe(false)
  })

  it('places every generated item on valid land outside exclusions', () => {
    const scatter = fillScatter(createScatterBuffer(500), 'scrub', 73)
    for (let index = 0; index < scatter.count; index += 1) {
      const x = scatter.positions[index * 3]
      const y = scatter.positions[index * 3 + 1]
      const z = scatter.positions[index * 3 + 2]
      expect(isScatterPointAllowed(x, z)).toBe(true)
      expect(y).toBeGreaterThan(ZONE.sea.level)
      expect(distanceToRoad(x, z)).toBeGreaterThanOrEqual(
        ZONE.road.scatterExclusionRadius,
      )
      expect(isInsideLocationFootprint(x, z)).toBe(false)
    }
  })
})
