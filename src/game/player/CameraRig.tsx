import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import { PLAYER } from '../../data/player'
import { getPausableDelta } from '../pause/pauseRuntime'
import { cameraRayFilterPredicate } from './cameraCollisionRegistry'
import { applyShoulderOffset, resolveCameraDistance } from './cameraMath'
import { playerStore } from './playerStore'

const baseTarget = new Vector3()
const target = new Vector3()
const right = new Vector3()
const desiredCamera = new Vector3()
const rayDirection = new Vector3()

export function CameraRig() {
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()
  const orbit = useRef<{
    yaw: number
    pitch: number
    distance: number
    fallbackDragging: boolean
  }>({
    yaw: 0,
    pitch: 0.32,
    distance: PLAYER.camera.distance,
    fallbackDragging: false,
  })
  const ray = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))
  const currentDistance = useRef<number>(PLAYER.camera.distance)

  useEffect(() => {
    const canvas = gl.domElement
    const pointerDown = (event: PointerEvent) => {
      if (import.meta.env.DEV && event.button === 1) {
        orbit.current.fallbackDragging = true
      } else if (event.button === 0 && document.pointerLockElement !== canvas) {
        void canvas.requestPointerLock().catch(() => undefined)
      }
    }
    const pointerUp = (event: PointerEvent) => {
      if (event.button === 1) orbit.current.fallbackDragging = false
    }
    const pointerMove = (event: PointerEvent) => {
      if (
        document.pointerLockElement !== canvas &&
        !orbit.current.fallbackDragging
      )
        return
      orbit.current.yaw -= event.movementX * 0.004
      orbit.current.pitch = MathUtils.clamp(
        orbit.current.pitch - event.movementY * 0.003,
        0.12,
        Math.PI * 0.48,
      )
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      orbit.current.distance = MathUtils.clamp(
        orbit.current.distance + event.deltaY * 0.004,
        PLAYER.camera.minimumDistance,
        PLAYER.camera.maximumDistance,
      )
    }

    canvas.addEventListener('pointerdown', pointerDown)
    window.addEventListener('pointerup', pointerUp)
    window.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', pointerDown)
      window.removeEventListener('pointerup', pointerUp)
      window.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [gl])

  useFrame((_, rawDeltaSeconds) => {
    const deltaSeconds = getPausableDelta(rawDeltaSeconds)
    const position = playerStore.getState().position
    const { yaw, pitch, distance } = orbit.current
    baseTarget.set(position.x, position.y + 0.45, position.z)

    const horizontalDistance = Math.cos(pitch) * distance
    desiredCamera.set(
      baseTarget.x + Math.sin(yaw) * horizontalDistance,
      baseTarget.y + Math.sin(pitch) * distance,
      baseTarget.z + Math.cos(yaw) * horizontalDistance,
    )
    applyShoulderOffset(
      baseTarget,
      desiredCamera,
      PLAYER.camera.shoulderOffset,
      right,
      target,
    )
    rayDirection.copy(desiredCamera).sub(target).normalize()

    ray.current.origin.x = target.x
    ray.current.origin.y = target.y
    ray.current.origin.z = target.z
    ray.current.dir.x = rayDirection.x
    ray.current.dir.y = rayDirection.y
    ray.current.dir.z = rayDirection.z
    const hit = world.castRay(
      ray.current,
      distance,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      playerStore.getState().collider ?? undefined,
      undefined,
      cameraRayFilterPredicate,
    )
    const collisionLimit = hit
      ? hit.timeOfImpact - PLAYER.camera.collisionPadding
      : null
    currentDistance.current = resolveCameraDistance(
      currentDistance.current,
      distance,
      collisionLimit,
      deltaSeconds,
      PLAYER.camera.collisionReturnDamping,
      PLAYER.camera.collisionMinimumDistance,
    )
    const renderedDistance = MathUtils.clamp(
      currentDistance.current,
      PLAYER.camera.collisionMinimumDistance,
      PLAYER.camera.maximumDistance,
    )
    playerStore.getState().cameraDistance = renderedDistance

    camera.position.copy(target).addScaledVector(rayDirection, renderedDistance)
    camera.lookAt(target)
  })

  return null
}
