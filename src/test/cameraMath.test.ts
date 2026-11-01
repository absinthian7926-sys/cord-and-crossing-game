import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import {
  applyShoulderOffset,
  resolveCameraDistance,
} from '../game/player/cameraMath'

describe('camera math', () => {
  it('applies the shoulder offset along camera right as orbit yaw changes', () => {
    const baseTarget = new Vector3(0, 1, 0)
    const right = new Vector3()
    const target = new Vector3()

    const cameraBehind = new Vector3(0, 3, 5)
    applyShoulderOffset(baseTarget, cameraBehind, 0.6, right, target)
    expect(right.x).toBeCloseTo(1)
    expect(right.y).toBeCloseTo(0)
    expect(right.z).toBeCloseTo(0)
    expect(target.x).toBeCloseTo(0.6)
    expect(target.y).toBeCloseTo(1)
    expect(target.z).toBeCloseTo(0)
    expect(cameraBehind.x).toBeCloseTo(0.6)

    const cameraRightOfPlayer = new Vector3(5, 3, 0)
    applyShoulderOffset(baseTarget, cameraRightOfPlayer, 0.6, right, target)
    expect(right.x).toBeCloseTo(0)
    expect(right.z).toBeCloseTo(-1)
    expect(target.z).toBeCloseTo(-0.6)
    expect(cameraRightOfPlayer.z).toBeCloseTo(-0.6)
  })

  it('pulls in immediately and smooths back toward the orbit distance', () => {
    expect(resolveCameraDistance(4.5, 4.5, 2.5, 1 / 60, 12)).toBe(2.5)
    const recovering = resolveCameraDistance(2.5, 4.5, null, 1 / 60, 12)
    expect(recovering).toBeGreaterThan(2.5)
    expect(recovering).toBeLessThan(4.5)
  })
})
