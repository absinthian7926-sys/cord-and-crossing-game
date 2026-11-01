import { ENEMY_ARROW, ENEMY_TYPES } from '../../data/enemies'
import { capsuleOverlapsPoint } from '../combat/hitboxes'

export type HeightSampler = (x: number, z: number) => number

export type ArrowPool = {
  active: Uint8Array
  x: Float32Array
  y: Float32Array
  z: Float32Array
  velocityX: Float32Array
  velocityY: Float32Array
  velocityZ: Float32Array
  ageSeconds: Float32Array
  distanceTravelled: Float32Array
}

export function createArrowPool(): ArrowPool {
  const size = ENEMY_ARROW.poolSize
  return {
    active: new Uint8Array(size),
    x: new Float32Array(size),
    y: new Float32Array(size),
    z: new Float32Array(size),
    velocityX: new Float32Array(size),
    velocityY: new Float32Array(size),
    velocityZ: new Float32Array(size),
    ageSeconds: new Float32Array(size),
    distanceTravelled: new Float32Array(size),
  }
}

export function launchArrow(
  pool: ArrowPool,
  startX: number,
  startY: number,
  startZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
): number {
  let index = -1
  for (let candidate = 0; candidate < pool.active.length; candidate += 1) {
    if (pool.active[candidate] === 0) {
      index = candidate
      break
    }
  }
  if (index < 0) return -1

  const offsetX = targetX - startX
  const offsetY = targetY - startY
  const offsetZ = targetZ - startZ
  const horizontalDistance = Math.hypot(offsetX, offsetZ)
  const speedSquared = ENEMY_ARROW.speed * ENEMY_ARROW.speed
  const discriminant =
    speedSquared * speedSquared -
    ENEMY_ARROW.gravity *
      (ENEMY_ARROW.gravity * horizontalDistance * horizontalDistance +
        2 * offsetY * speedSquared)

  pool.active[index] = 1
  pool.x[index] = startX
  pool.y[index] = startY
  pool.z[index] = startZ
  if (horizontalDistance > 0 && discriminant >= 0) {
    const tangent =
      (speedSquared - Math.sqrt(discriminant)) /
      (ENEMY_ARROW.gravity * horizontalDistance)
    const cosine = 1 / Math.sqrt(1 + tangent * tangent)
    const horizontalSpeed = ENEMY_ARROW.speed * cosine
    pool.velocityX[index] = (offsetX / horizontalDistance) * horizontalSpeed
    pool.velocityY[index] = tangent * horizontalSpeed
    pool.velocityZ[index] = (offsetZ / horizontalDistance) * horizontalSpeed
  } else {
    const length = Math.hypot(offsetX, offsetY, offsetZ)
    const inverseLength = length > 0 ? 1 / length : 0
    pool.velocityX[index] = offsetX * inverseLength * ENEMY_ARROW.speed
    pool.velocityY[index] = offsetY * inverseLength * ENEMY_ARROW.speed
    pool.velocityZ[index] =
      length > 0
        ? offsetZ * inverseLength * ENEMY_ARROW.speed
        : -ENEMY_ARROW.speed
  }
  pool.ageSeconds[index] = 0
  pool.distanceTravelled[index] = 0
  return index
}

export function arrowIntersectsPlayer(
  arrowX: number,
  arrowY: number,
  arrowZ: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  playerRadius: number,
): boolean {
  const offsetX = arrowX - playerX
  const offsetY = arrowY - playerY
  const offsetZ = arrowZ - playerZ
  const combinedRadius = Math.max(0, playerRadius) + ENEMY_ARROW.hitRadius
  return (
    offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ <=
    combinedRadius * combinedRadius
  )
}

export function arrowDamage(invulnerable: boolean): number {
  return invulnerable ? 0 : ENEMY_TYPES.brigandArcher.damage
}

export function arrowPathIntersectsPlayer(
  previousX: number,
  previousY: number,
  previousZ: number,
  arrowX: number,
  arrowY: number,
  arrowZ: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  playerRadius: number,
): boolean {
  return capsuleOverlapsPoint(
    playerX,
    playerY,
    playerZ,
    previousX,
    previousY,
    previousZ,
    arrowX,
    arrowY,
    arrowZ,
    Math.max(0, playerRadius) + ENEMY_ARROW.hitRadius,
  )
}

export function stepArrows(
  pool: ArrowPool,
  dtSeconds: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  playerRadius: number,
  playerInvulnerable: boolean,
  heightAt: HeightSampler,
): number {
  const deltaSeconds = Math.max(0, dtSeconds)
  let damage = 0

  for (let index = 0; index < pool.active.length; index += 1) {
    if (pool.active[index] === 0) continue

    const previousX = pool.x[index]
    const previousY = pool.y[index]
    const previousZ = pool.z[index]
    pool.velocityY[index] -= ENEMY_ARROW.gravity * deltaSeconds
    pool.x[index] += pool.velocityX[index] * deltaSeconds
    pool.y[index] += pool.velocityY[index] * deltaSeconds
    pool.z[index] += pool.velocityZ[index] * deltaSeconds
    pool.ageSeconds[index] += deltaSeconds
    pool.distanceTravelled[index] += Math.hypot(
      pool.x[index] - previousX,
      pool.y[index] - previousY,
      pool.z[index] - previousZ,
    )

    if (
      arrowPathIntersectsPlayer(
        previousX,
        previousY,
        previousZ,
        pool.x[index],
        pool.y[index],
        pool.z[index],
        playerX,
        playerY,
        playerZ,
        playerRadius,
      )
    ) {
      damage += arrowDamage(playerInvulnerable)
      pool.active[index] = 0
      continue
    }

    if (
      pool.y[index] <=
        heightAt(pool.x[index], pool.z[index]) + ENEMY_ARROW.hitRadius ||
      pool.ageSeconds[index] >= ENEMY_ARROW.lifetimeSeconds ||
      pool.distanceTravelled[index] >= ENEMY_ARROW.maximumRange
    ) {
      pool.active[index] = 0
    }
  }

  return damage
}

export function countActiveArrows(pool: ArrowPool): number {
  let count = 0
  for (let index = 0; index < pool.active.length; index += 1)
    count += pool.active[index]
  return count
}
