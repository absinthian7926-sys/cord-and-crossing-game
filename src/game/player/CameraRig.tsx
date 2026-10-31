import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import { PLAYER } from '../../data/player'
import { playerStore } from './playerStore'

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
    dragging: boolean
  }>({
    yaw: 0,
    pitch: 0.32,
    distance: PLAYER.camera.distance,
    dragging: false,
  })
  const ray = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))

  useEffect(() => {
    const canvas = gl.domElement
    const pointerDown = (event: PointerEvent) => {
      if (event.button === 0) orbit.current.dragging = true
    }
    const pointerUp = () => {
      orbit.current.dragging = false
    }
    const pointerMove = (event: PointerEvent) => {
      if (!orbit.current.dragging) return
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

  useFrame(() => {
    const position = playerStore.getState().position
    const { yaw, pitch, distance } = orbit.current
    right.set(Math.cos(yaw), 0, -Math.sin(yaw))
    target.set(position.x, position.y + 0.45, position.z)
    target.addScaledVector(right, PLAYER.camera.shoulderOffset)

    const horizontalDistance = Math.cos(pitch) * distance
    desiredCamera.set(
      target.x + Math.sin(yaw) * horizontalDistance,
      target.y + Math.sin(pitch) * distance,
      target.z + Math.cos(yaw) * horizontalDistance,
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
    )
    const collisionDistance = hit
      ? MathUtils.clamp(
          hit.timeOfImpact - 0.2,
          PLAYER.camera.minimumDistance,
          PLAYER.camera.maximumDistance,
        )
      : distance

    camera.position
      .copy(target)
      .addScaledVector(rayDirection, collisionDistance)
    camera.lookAt(target)
  })

  return null
}
