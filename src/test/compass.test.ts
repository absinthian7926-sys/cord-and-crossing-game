import { describe, expect, it } from 'vitest'
import {
  cameraHeadingFromYaw,
  createCompassMarker,
  markerBearingDegrees,
  resolveCompassMarker,
  shortestDegreeDelta,
  wrapDegrees,
} from '../ui/compass'

describe('compass math', () => {
  it('wraps headings and converts camera yaw to the axis convention', () => {
    expect(wrapDegrees(0)).toBe(0)
    expect(wrapDegrees(360)).toBe(0)
    expect(wrapDegrees(-1)).toBe(359)
    expect(cameraHeadingFromYaw(0)).toBe(0)
    expect(cameraHeadingFromYaw(-Math.PI / 2)).toBe(90)
    expect(cameraHeadingFromYaw(Math.PI)).toBe(180)
    expect(cameraHeadingFromYaw(Math.PI / 2)).toBe(270)
  })

  it('computes N, E, S and W marker bearings', () => {
    expect(markerBearingDegrees(0, 0, 0, -1)).toBe(0)
    expect(markerBearingDegrees(0, 0, 1, 0)).toBe(90)
    expect(markerBearingDegrees(0, 0, 0, 1)).toBe(180)
    expect(markerBearingDegrees(0, 0, -1, 0)).toBe(270)
  })

  it('uses the shortest wraparound at 359 and 1 degrees', () => {
    expect(shortestDegreeDelta(359, 1)).toBe(2)
    expect(shortestDegreeDelta(1, 359)).toBe(-2)
  })

  it('maps visible markers into the 120 degree, 360 pixel strip', () => {
    const output = createCompassMarker()
    expect(resolveCompassMarker(0, 0, 0, 1, -1, output)).toBe(output)
    expect(output.visible).toBe(true)
    expect(output.bearingDegrees).toBe(45)
    expect(output.relativeDegrees).toBe(45)
    expect(output.offsetPixels).toBe(135)

    resolveCompassMarker(0, 0, 0, 1, 0, output)
    expect(output.visible).toBe(false)
    expect(output.offsetPixels).toBe(270)
  })
})
