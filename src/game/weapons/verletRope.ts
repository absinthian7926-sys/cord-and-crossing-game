import { REACHBLADE } from '../../data/weapons'
import type { CordMode } from './cordState'

export type Point3 = { x: number; y: number; z: number }

export type VerletRope = {
  positions: Float32Array
  previous: Float32Array
  pointCount: number
  activePoints: number
  segmentLength: number
}

export function createVerletRope(start: Point3, end: Point3): VerletRope {
  const pointCount = REACHBLADE.rope.pointCount
  const positions = new Float32Array(pointCount * 3)
  const previous = new Float32Array(pointCount * 3)
  for (let index = 0; index < pointCount; index += 1) {
    const t = index / (pointCount - 1)
    const offset = index * 3
    positions[offset] = start.x + (end.x - start.x) * t
    positions[offset + 1] = start.y + (end.y - start.y) * t
    positions[offset + 2] = start.z + (end.z - start.z) * t
    previous[offset] = positions[offset]
    previous[offset + 1] = positions[offset + 1]
    previous[offset + 2] = positions[offset + 2]
  }
  return {
    positions,
    previous,
    pointCount,
    activePoints: pointCount,
    segmentLength: REACHBLADE.maxCordLength / (pointCount - 1),
  }
}

function pinPoint(array: Float32Array, index: number, point: Point3): void {
  const offset = index * 3
  array[offset] = point.x
  array[offset + 1] = point.y
  array[offset + 2] = point.z
}

function constrain(
  rope: VerletRope,
  start: Point3,
  end: Point3,
  pinEnd: boolean,
): void {
  const { positions, segmentLength, activePoints } = rope
  pinPoint(positions, 0, start)
  if (pinEnd) pinPoint(positions, activePoints - 1, end)
  for (let index = 0; index < activePoints - 1; index += 1) {
    const a = index * 3
    const b = a + 3
    const dx = positions[b] - positions[a]
    const dy = positions[b + 1] - positions[a + 1]
    const dz = positions[b + 2] - positions[a + 2]
    const distance = Math.hypot(dx, dy, dz)
    if (distance === 0) continue
    const correction = (distance - segmentLength) / distance
    const moveA =
      index === 0 ? 0 : pinEnd && index + 1 === activePoints - 1 ? 1 : 0.5
    const moveB =
      index === 0 ? 1 : pinEnd && index + 1 === activePoints - 1 ? 0 : 0.5
    positions[a] += dx * correction * moveA
    positions[a + 1] += dy * correction * moveA
    positions[a + 2] += dz * correction * moveA
    positions[b] -= dx * correction * moveB
    positions[b + 1] -= dy * correction * moveB
    positions[b + 2] -= dz * correction * moveB
  }
  pinPoint(positions, 0, start)
  if (pinEnd) pinPoint(positions, activePoints - 1, end)
}

export function stepVerletRope(
  rope: VerletRope,
  deltaSeconds: number,
  hand: Point3,
  blade: Point3,
  mode: CordMode,
): void {
  const dt = Math.max(0, Math.min(deltaSeconds, 1 / 30))
  const pinEnd = mode === 'Out' || mode === 'Returning' || mode === 'InHand'
  rope.activePoints =
    mode === 'Cut' ? REACHBLADE.rope.cutVisiblePoints : rope.pointCount
  pinPoint(rope.positions, 0, hand)
  pinPoint(rope.previous, 0, hand)
  if (pinEnd) {
    pinPoint(rope.positions, rope.activePoints - 1, blade)
    pinPoint(rope.previous, rope.activePoints - 1, blade)
  }

  const lastIntegrated = pinEnd ? rope.activePoints - 1 : rope.activePoints
  for (let index = 1; index < lastIntegrated; index += 1) {
    const offset = index * 3
    const x = rope.positions[offset]
    const y = rope.positions[offset + 1]
    const z = rope.positions[offset + 2]
    const velocityX = (x - rope.previous[offset]) * REACHBLADE.rope.damping
    const velocityY = (y - rope.previous[offset + 1]) * REACHBLADE.rope.damping
    const velocityZ = (z - rope.previous[offset + 2]) * REACHBLADE.rope.damping
    rope.previous[offset] = x
    rope.previous[offset + 1] = y
    rope.previous[offset + 2] = z
    rope.positions[offset] = x + velocityX
    rope.positions[offset + 1] = Math.max(
      REACHBLADE.rope.groundHeight,
      y + velocityY - REACHBLADE.rope.gravity * dt * dt,
    )
    rope.positions[offset + 2] = z + velocityZ
  }

  for (
    let iteration = 0;
    iteration < REACHBLADE.rope.constraintIterations;
    iteration += 1
  ) {
    constrain(rope, hand, blade, pinEnd)
    for (let index = 1; index < lastIntegrated; index += 1) {
      const y = index * 3 + 1
      if (rope.positions[y] < REACHBLADE.rope.groundHeight) {
        rope.positions[y] = REACHBLADE.rope.groundHeight
      }
    }
  }
}

export function ropeLength(rope: VerletRope): number {
  let total = 0
  for (let index = 0; index < rope.activePoints - 1; index += 1) {
    const a = index * 3
    const b = a + 3
    total += Math.hypot(
      rope.positions[b] - rope.positions[a],
      rope.positions[b + 1] - rope.positions[a + 1],
      rope.positions[b + 2] - rope.positions[a + 2],
    )
  }
  return total
}
