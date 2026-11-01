import { describe, expect, it } from 'vitest'
import { ZONE } from '../data/zone'
import {
  ROAD_LENGTH,
  distanceToRoad,
  roadPointAt,
  roadProgressAt,
  sampleRoad,
} from '../game/world/road'

describe('Saltwind Rise road', () => {
  it('starts at the waystation and ends about 600 metres east', () => {
    const start = roadPointAt(0, { x: 0, z: 0 })
    const end = roadPointAt(1, { x: 0, z: 0 })
    expect(start.x).toBeCloseTo(ZONE.locations.A.center[0])
    expect(start.z).toBeCloseTo(ZONE.locations.A.center[1])
    expect(end.x).toBeCloseTo(600)
    expect(end.z).toBeCloseTo(-80)
    expect(ROAD_LENGTH).toBeGreaterThan(600)
    expect(ROAD_LENGTH).toBeLessThan(700)
  })

  it('computes distance and progress at known points', () => {
    expect(distanceToRoad(0, 0)).toBe(0)
    expect(distanceToRoad(0, 10)).toBeCloseTo(10)
    expect(distanceToRoad(600, -80)).toBe(0)
    expect(roadProgressAt(0, 0)).toBe(0)
    expect(roadProgressAt(600, -80)).toBeCloseTo(1)
  })

  it('fills a caller-owned sample buffer', () => {
    const samples = new Float32Array(10)
    expect(sampleRoad(samples, 5)).toBe(samples)
    expect(Array.from(samples.slice(0, 2))).toEqual([0, 0])
    expect(samples[8]).toBeCloseTo(600)
    expect(samples[9]).toBeCloseTo(-80)
  })
})
