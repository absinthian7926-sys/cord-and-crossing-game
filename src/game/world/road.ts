import { ZONE } from '../../data/zone'

export type MutablePoint2 = { x: number; z: number }

const points = ZONE.road.controlPoints
const segmentLengths = new Float64Array(points.length - 1)
const cumulativeLengths = new Float64Array(points.length)

let length = 0
for (let index = 0; index < points.length - 1; index += 1) {
  const start = points[index]
  const end = points[index + 1]
  const segmentLength = Math.hypot(end[0] - start[0], end[1] - start[1])
  segmentLengths[index] = segmentLength
  length += segmentLength
  cumulativeLengths[index + 1] = length
}

export const ROAD_LENGTH = length

function nearestOnPolyline(
  x: number,
  z: number,
  line: readonly (readonly [number, number])[],
): { distanceSquared: number; progress: number } {
  let bestDistanceSquared = Number.POSITIVE_INFINITY
  let bestDistanceAlong = 0
  let distanceBeforeSegment = 0
  let totalLength = 0

  for (let index = 0; index < line.length - 1; index += 1) {
    const start = line[index]
    const end = line[index + 1]
    const dx = end[0] - start[0]
    const dz = end[1] - start[1]
    const segmentLengthSquared = dx * dx + dz * dz
    const segmentLength = Math.sqrt(segmentLengthSquared)
    const projection =
      segmentLengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((x - start[0]) * dx + (z - start[1]) * dz) /
                segmentLengthSquared,
            ),
          )
    const nearestX = start[0] + dx * projection
    const nearestZ = start[1] + dz * projection
    const offsetX = x - nearestX
    const offsetZ = z - nearestZ
    const distanceSquared = offsetX * offsetX + offsetZ * offsetZ
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared
      bestDistanceAlong = distanceBeforeSegment + segmentLength * projection
    }
    distanceBeforeSegment += segmentLength
    totalLength += segmentLength
  }

  return {
    distanceSquared: bestDistanceSquared,
    progress: totalLength === 0 ? 0 : bestDistanceAlong / totalLength,
  }
}

export function distanceToRoad(x: number, z: number): number {
  let bestDistanceSquared = Number.POSITIVE_INFINITY
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const dx = end[0] - start[0]
    const dz = end[1] - start[1]
    const denominator = dx * dx + dz * dz
    const projection = Math.max(
      0,
      Math.min(
        1,
        denominator === 0
          ? 0
          : ((x - start[0]) * dx + (z - start[1]) * dz) / denominator,
      ),
    )
    const offsetX = x - (start[0] + dx * projection)
    const offsetZ = z - (start[1] + dz * projection)
    const distanceSquared = offsetX * offsetX + offsetZ * offsetZ
    if (distanceSquared < bestDistanceSquared)
      bestDistanceSquared = distanceSquared
  }
  return Math.sqrt(bestDistanceSquared)
}

export function roadProgressAt(x: number, z: number): number {
  let bestDistanceSquared = Number.POSITIVE_INFINITY
  let bestDistanceAlong = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const dx = end[0] - start[0]
    const dz = end[1] - start[1]
    const denominator = dx * dx + dz * dz
    const projection = Math.max(
      0,
      Math.min(
        1,
        denominator === 0
          ? 0
          : ((x - start[0]) * dx + (z - start[1]) * dz) / denominator,
      ),
    )
    const offsetX = x - (start[0] + dx * projection)
    const offsetZ = z - (start[1] + dz * projection)
    const distanceSquared = offsetX * offsetX + offsetZ * offsetZ
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared
      bestDistanceAlong =
        cumulativeLengths[index] + segmentLengths[index] * projection
    }
  }
  return ROAD_LENGTH === 0 ? 0 : bestDistanceAlong / ROAD_LENGTH
}

export function roadPointAt(
  progress: number,
  out: MutablePoint2,
): MutablePoint2 {
  const distance = Math.max(0, Math.min(1, progress)) * ROAD_LENGTH
  let segmentIndex = segmentLengths.length - 1
  for (let index = 0; index < segmentLengths.length; index += 1) {
    if (distance <= cumulativeLengths[index + 1]) {
      segmentIndex = index
      break
    }
  }
  const segmentLength = segmentLengths[segmentIndex]
  const localDistance = distance - cumulativeLengths[segmentIndex]
  const localProgress = segmentLength === 0 ? 0 : localDistance / segmentLength
  const start = points[segmentIndex]
  const end = points[segmentIndex + 1]
  out.x = start[0] + (end[0] - start[0]) * localProgress
  out.z = start[1] + (end[1] - start[1]) * localProgress
  return out
}

export function sampleRoad(
  target: Float32Array,
  sampleCount: number,
): Float32Array {
  if (sampleCount < 2) throw new RangeError('sampleCount must be at least 2')
  if (target.length < sampleCount * 2)
    throw new RangeError('target is too small for road samples')
  const point = { x: 0, z: 0 }
  for (let index = 0; index < sampleCount; index += 1) {
    roadPointAt(index / (sampleCount - 1), point)
    target[index * 2] = point.x
    target[index * 2 + 1] = point.z
  }
  return target
}

export function distanceToCliffPath(x: number, z: number): number {
  return Math.sqrt(
    nearestOnPolyline(x, z, ZONE.cliffPath.points).distanceSquared,
  )
}
