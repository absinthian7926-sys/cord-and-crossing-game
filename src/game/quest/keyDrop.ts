import { CAMP_LEADER, CAMP_PROGRESS, ENEMY_SPAWNS } from '../../data/enemies'
import { FRAME_SHELTER_KEY } from '../../data/quests'
import { ZONE } from '../../data/zone'
import { collectLargeRockColliders } from '../world/rockColliders'
import { generateScatter } from '../world/scatter'
import { heightAt } from '../world/terrain'

export type KeyDropPoint = { x: number; z: number }
export type KeyDropPosition = KeyDropPoint & { y: number }

export type CircularKeyDropBlocker = {
  readonly shape: 'circle'
  readonly x: number
  readonly z: number
  readonly radius: number
}

export type RectangularKeyDropBlocker = {
  readonly shape: 'rectangle'
  readonly x: number
  readonly z: number
  readonly halfWidth: number
  readonly halfDepth: number
}

export type KeyDropBlocker = CircularKeyDropBlocker | RectangularKeyDropBlocker

export type KeyDropWalkable = (x: number, z: number) => boolean

let cachedCampBlockers: readonly KeyDropBlocker[] | null = null

function distanceFromRectangleEdge(
  x: number,
  z: number,
  blocker: RectangularKeyDropBlocker,
): number {
  const dx = Math.max(Math.abs(x - blocker.x) - blocker.halfWidth, 0)
  const dz = Math.max(Math.abs(z - blocker.z) - blocker.halfDepth, 0)
  if (dx === 0 && dz === 0) return 0
  return Math.hypot(dx, dz)
}

export function distanceFromKeyDropBlockerEdge(
  x: number,
  z: number,
  blocker: KeyDropBlocker,
): number {
  if (blocker.shape === 'circle')
    return Math.max(
      0,
      Math.hypot(x - blocker.x, z - blocker.z) - blocker.radius,
    )
  return distanceFromRectangleEdge(x, z, blocker)
}

export function isKeyDropPointClear(
  x: number,
  z: number,
  blockers: readonly KeyDropBlocker[],
  clearance = FRAME_SHELTER_KEY.drop.clearance,
): boolean {
  for (let index = 0; index < blockers.length; index += 1)
    if (distanceFromKeyDropBlockerEdge(x, z, blockers[index]) < clearance)
      return false
  return true
}

export function isCampKeyDropWalkable(x: number, z: number): boolean {
  return (
    x >= ZONE.bounds.minimumX &&
    x <= ZONE.bounds.maximumX &&
    z >= ZONE.bounds.minimumZ &&
    z <= ZONE.bounds.maximumZ &&
    Number.isFinite(heightAt(x, z)) &&
    heightAt(x, z) > ZONE.sea.level
  )
}

function fireCenter(): KeyDropPoint {
  return {
    x: ZONE.locations.D.center[0] + ZONE.placeholders.camp.fireOffset[0],
    z: ZONE.locations.D.center[1] + ZONE.placeholders.camp.fireOffset[1],
  }
}

export function campKeyDropFallbackPoint(): KeyDropPoint {
  const fire = fireCenter()
  const towardCheckpointX = CAMP_PROGRESS.respawn[0] - fire.x
  const towardCheckpointZ = CAMP_PROGRESS.respawn[1] - fire.z
  const inverseLength = 1 / Math.hypot(towardCheckpointX, towardCheckpointZ)
  return {
    x:
      fire.x +
      towardCheckpointX *
        inverseLength *
        FRAME_SHELTER_KEY.drop.fallbackDistanceFromFire,
    z:
      fire.z +
      towardCheckpointZ *
        inverseLength *
        FRAME_SHELTER_KEY.drop.fallbackDistanceFromFire,
  }
}

export function getCampKeyDropBlockers(): readonly KeyDropBlocker[] {
  if (cachedCampBlockers !== null) return cachedCampBlockers
  const camp = ZONE.placeholders.camp
  const center = ZONE.locations.D.center
  const blockers: KeyDropBlocker[] = [
    {
      shape: 'circle',
      x: center[0] + camp.fireOffset[0],
      z: center[1] + camp.fireOffset[1],
      radius: camp.fireRadius,
    },
  ]
  for (let index = 0; index < camp.tentOffsets.length; index += 1) {
    const offset = camp.tentOffsets[index]
    blockers.push({
      shape: 'rectangle',
      x: center[0] + offset[0],
      z: center[1] + offset[1],
      halfWidth: camp.tentSize[0] * 0.5,
      halfDepth: camp.tentSize[2] * 0.5,
    })
  }
  blockers.push({
    shape: 'rectangle',
    x: center[0] + camp.lookoutOffset[0],
    z: center[1] + camp.lookoutOffset[1],
    halfWidth: camp.lookoutSize[0] * 0.5,
    halfDepth: camp.lookoutSize[2] * 0.5,
  })

  const rocks = collectLargeRockColliders(
    generateScatter('rocks', ZONE.quality.default),
  )
  for (let index = 0; index < rocks.length; index += 1) {
    const rock = rocks[index]
    if (
      Math.hypot(rock.x - center[0], rock.z - center[1]) >
      ZONE.locations.D.radius + rock.radius
    )
      continue
    blockers.push({
      shape: 'circle',
      x: rock.x,
      z: rock.z,
      radius: rock.radius,
    })
  }
  cachedCampBlockers = blockers
  return cachedCampBlockers
}

export function resolveKeyDropPoint(
  leaderX: number,
  leaderZ: number,
  blockers: readonly KeyDropBlocker[],
  isWalkable: KeyDropWalkable = isCampKeyDropWalkable,
): KeyDropPoint {
  if (
    isWalkable(leaderX, leaderZ) &&
    isKeyDropPointClear(leaderX, leaderZ, blockers)
  )
    return { x: leaderX, z: leaderZ }

  const fallback = campKeyDropFallbackPoint()
  const startAngle = Math.atan2(fallback.z - leaderZ, fallback.x - leaderX)
  for (
    let radius = FRAME_SHELTER_KEY.drop.searchStep;
    radius <= FRAME_SHELTER_KEY.drop.searchRadius;
    radius += FRAME_SHELTER_KEY.drop.searchStep
  ) {
    for (
      let direction = 0;
      direction < FRAME_SHELTER_KEY.drop.searchDirections;
      direction += 1
    ) {
      const angle =
        startAngle +
        (direction * Math.PI * 2) / FRAME_SHELTER_KEY.drop.searchDirections
      const x = leaderX + Math.cos(angle) * radius
      const z = leaderZ + Math.sin(angle) * radius
      if (isWalkable(x, z) && isKeyDropPointClear(x, z, blockers))
        return { x, z }
    }
  }
  return fallback
}

export function resolveCampKeyDropPosition(
  position: KeyDropPosition,
): KeyDropPosition {
  const point = resolveKeyDropPoint(
    position.x,
    position.z,
    getCampKeyDropBlockers(),
  )
  if (point.x === position.x && point.z === position.z)
    return { x: position.x, y: position.y, z: position.z }
  return {
    x: point.x,
    y: heightAt(point.x, point.z) + FRAME_SHELTER_KEY.presentation.ringRadius,
    z: point.z,
  }
}

export function defaultCampKeyDropPosition(): KeyDropPosition {
  const point = resolveKeyDropPoint(
    ENEMY_SPAWNS.camp.anchor[0] + CAMP_LEADER.campOffset[0],
    ENEMY_SPAWNS.camp.anchor[1] + CAMP_LEADER.campOffset[1],
    getCampKeyDropBlockers(),
  )
  return {
    x: point.x,
    y: heightAt(point.x, point.z) + FRAME_SHELTER_KEY.presentation.ringRadius,
    z: point.z,
  }
}

export function isWithinKeyPickupRadius(
  playerX: number,
  playerZ: number,
  keyX: number,
  keyZ: number,
  radius = FRAME_SHELTER_KEY.pickupRadius,
): boolean {
  const offsetX = playerX - keyX
  const offsetZ = playerZ - keyZ
  return offsetX * offsetX + offsetZ * offsetZ <= radius * radius
}

export function formatPendingKeyTrackerText(distanceMeters: number): string {
  return `Take the key (${Math.max(0, Math.round(distanceMeters))} m).`
}

export function formatPendingKeyCompassLabel(distanceMeters: number): string {
  return `Key ${Math.max(0, Math.round(distanceMeters))} m`
}
