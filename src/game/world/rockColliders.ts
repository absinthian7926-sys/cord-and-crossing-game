import { ZONE } from '../../data/zone'
import { distanceToCliffPath, distanceToRoad } from './road'
import type { ScatterBuffer } from './scatter'

export type LargeRockColliderData = {
  x: number
  y: number
  z: number
  radius: number
}

export function collectLargeRockColliders(
  rocks: ScatterBuffer,
): LargeRockColliderData[] {
  const colliders: LargeRockColliderData[] = []
  for (let index = 0; index < rocks.count; index += 1) {
    const radius = rocks.scales[index]
    if (radius < ZONE.scatter.largeRockMinimumScale) continue
    const offset = index * 3
    const x = rocks.positions[offset]
    const y = rocks.positions[offset + 1]
    const z = rocks.positions[offset + 2]
    if (
      distanceToRoad(x, z) <= ZONE.scatter.colliderPathDistance ||
      distanceToCliffPath(x, z) <= ZONE.scatter.colliderPathDistance
    )
      colliders.push({ x, y: y + radius, z, radius })
  }
  return colliders
}
