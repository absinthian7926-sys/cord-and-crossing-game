import { MathUtils, Vector3 } from 'three'

const worldUp = new Vector3(0, 1, 0)
const viewDirection = new Vector3()

export function applyShoulderOffset(
  baseTarget: Vector3,
  desiredCamera: Vector3,
  shoulderOffset: number,
  outRight: Vector3,
  outTarget: Vector3,
): void {
  viewDirection.copy(baseTarget).sub(desiredCamera).normalize()
  outRight.crossVectors(viewDirection, worldUp).normalize()
  outTarget.copy(baseTarget).addScaledVector(outRight, shoulderOffset)
  desiredCamera.addScaledVector(outRight, shoulderOffset)
}

export function resolveCameraDistance(
  currentDistance: number,
  unobstructedDistance: number,
  collisionDistance: number | null,
  deltaSeconds: number,
  returnDamping: number,
  collisionMinimumDistance = 0,
): number {
  const targetDistance =
    collisionDistance === null
      ? unobstructedDistance
      : MathUtils.clamp(
          collisionDistance,
          collisionMinimumDistance,
          unobstructedDistance,
        )
  if (targetDistance <= currentDistance) return targetDistance
  return MathUtils.damp(
    currentDistance,
    targetDistance,
    returnDamping,
    Math.max(0, deltaSeconds),
  )
}

export function shouldCameraRayHitCollider(
  colliderHandle: number,
  isSensor: boolean,
  excludedColliderHandles: ReadonlySet<number>,
): boolean {
  return !isSensor && !excludedColliderHandles.has(colliderHandle)
}
