import { describe, expect, it } from 'vitest'
import { QUALITY_LEVELS, ZONE } from '../data/zone'

describe('Saltwind Rise data', () => {
  it('defines locations A through E and the one-kilometre bounds', () => {
    expect(Object.keys(ZONE.locations)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(ZONE.bounds.maximumX - ZONE.bounds.minimumX).toBe(1_000)
    expect(ZONE.bounds.maximumZ - ZONE.bounds.minimumZ).toBe(1_000)
    expect(ZONE.locations.A.center).toEqual([0, 0])
  })

  it('places the camp about 450 metres from spawn', () => {
    const [x, z] = ZONE.locations.D.center
    expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(425)
    expect(Math.hypot(x, z)).toBeLessThanOrEqual(475)
  })

  it('keeps the inert portico pillars 2.4 metres apart', () => {
    expect(ZONE.portico.pillarSpacing).toBe(2.4)
  })

  it('defaults to Medium with bounded quality maps', () => {
    expect(QUALITY_LEVELS).toContain(ZONE.quality.default)
    expect(ZONE.quality.default).toBe('Medium')
    expect(ZONE.lighting.shadowMapByQuality.Medium).toBe(1_024)
    expect(ZONE.scatter.densityByQuality.Medium).toBe(1)
  })
})
