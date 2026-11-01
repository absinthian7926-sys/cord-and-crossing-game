import { shouldCameraRayHitCollider } from './cameraMath'

type CameraFilterCollider = {
  handle: number
  isSensor: () => boolean
}

const excludedColliderHandles = new Set<number>()

export function registerCameraExcludedCollider(colliderHandle: number): void {
  excludedColliderHandles.add(colliderHandle)
}

export function unregisterCameraExcludedCollider(colliderHandle: number): void {
  excludedColliderHandles.delete(colliderHandle)
}

export function cameraRayFilterPredicate(
  collider: CameraFilterCollider,
): boolean {
  return shouldCameraRayHitCollider(
    collider.handle,
    collider.isSensor(),
    excludedColliderHandles,
  )
}
