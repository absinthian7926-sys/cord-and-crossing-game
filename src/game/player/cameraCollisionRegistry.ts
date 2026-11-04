import { shouldCameraRayHitCollider } from './cameraMath'

type CameraFilterCollider = {
  handle: number
  isSensor: () => boolean
}

const excludedColliderHandles = new Set<number>()
const cameraFadeHandlers = new Map<number, (faded: boolean) => void>()
const fadedColliderHandles: number[] = []

export function registerCameraExcludedCollider(colliderHandle: number): void {
  excludedColliderHandles.add(colliderHandle)
}

export function unregisterCameraExcludedCollider(colliderHandle: number): void {
  excludedColliderHandles.delete(colliderHandle)
}

export function registerCameraFadeCollider(
  colliderHandle: number,
  setFaded: (faded: boolean) => void,
): void {
  cameraFadeHandlers.set(colliderHandle, setFaded)
}

export function unregisterCameraFadeCollider(colliderHandle: number): void {
  const setFaded = cameraFadeHandlers.get(colliderHandle)
  setFaded?.(false)
  cameraFadeHandlers.delete(colliderHandle)
  excludedColliderHandles.delete(colliderHandle)
}

export function beginCameraFadeFrame(): void {
  for (let index = 0; index < fadedColliderHandles.length; index += 1) {
    const handle = fadedColliderHandles[index]
    cameraFadeHandlers.get(handle)?.(false)
    excludedColliderHandles.delete(handle)
  }
  fadedColliderHandles.length = 0
}

export function fadeCameraCollider(colliderHandle: number): boolean {
  const setFaded = cameraFadeHandlers.get(colliderHandle)
  if (!setFaded) return false
  setFaded(true)
  excludedColliderHandles.add(colliderHandle)
  fadedColliderHandles.push(colliderHandle)
  return true
}

export function isCameraFadeCollider(colliderHandle: number): boolean {
  return cameraFadeHandlers.has(colliderHandle)
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
