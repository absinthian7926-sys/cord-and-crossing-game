import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  BallCollider,
  CapsuleCollider,
  RigidBody,
  type RapierCollider,
} from '@react-three/rapier'
import { useCallback, useEffect, useRef } from 'react'
import type { Group } from 'three'
import { ENEMY_PRESENTATION } from '../../data/enemies'
import { HOLLEN } from '../../data/quests'
import {
  registerCameraExcludedCollider,
  unregisterCameraExcludedCollider,
} from '../player/cameraCollisionRegistry'
import { playerStore } from '../player/playerStore'
import { heightAt } from '../world/terrain'

export type HollenProps = {
  readonly dialogueOpen: boolean
  readonly interactionEnabled?: boolean
  readonly onProximityChange?: (nearHollen: boolean) => void
  readonly onTransientProximityChange?: (nearHollen: boolean) => void
}

export function Hollen({
  dialogueOpen,
  interactionEnabled = true,
  onProximityChange,
  onTransientProximityChange,
}: HollenProps) {
  const visual = useRef<Group>(null)
  const interactionSensor = useRef<RapierCollider>(null)
  const proximityCallback = useRef(onProximityChange)
  const transientProximityCallback = useRef(onTransientProximityChange)
  const nearbyRef = useRef(false)
  const prompt = useRef<HTMLDivElement>(null)
  const bodyHalfHeight = Math.max(
    0,
    (HOLLEN.body.height - HOLLEN.body.radius * 2) / 2,
  )
  const x = HOLLEN.position[0]
  const z = HOLLEN.position[1]
  const ground = heightAt(x, z)
  const roadFacing = Math.atan2(
    HOLLEN.facingTarget[0] - x,
    HOLLEN.facingTarget[1] - z,
  )

  useEffect(() => {
    const sensor = interactionSensor.current
    if (!sensor) return
    registerCameraExcludedCollider(sensor.handle)
    return () => unregisterCameraExcludedCollider(sensor.handle)
  }, [])

  useEffect(() => {
    proximityCallback.current = onProximityChange
    transientProximityCallback.current = onTransientProximityChange
  }, [onProximityChange, onTransientProximityChange])

  useEffect(
    () => () => {
      proximityCallback.current?.(false)
      transientProximityCallback.current?.(false)
    },
    [],
  )

  const setNearby = useCallback((isNearby: boolean, publish: boolean) => {
    if (isNearby !== nearbyRef.current) {
      nearbyRef.current = isNearby
      transientProximityCallback.current?.(isNearby)
    }
    if (prompt.current) prompt.current.hidden = !isNearby
    if (publish) proximityCallback.current?.(isNearby)
  }, [])

  useFrame(() => {
    const player = playerStore.getState().position
    const offsetX = player.x - x
    const offsetZ = player.z - z
    setNearby(
      offsetX * offsetX + offsetZ * offsetZ <= HOLLEN.interactionRadius ** 2,
      false,
    )
    if (dialogueOpen && visual.current)
      visual.current.rotation.y = Math.atan2(offsetX, offsetZ)
  })

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[x, ground, z]}
      name="hollen"
    >
      <CapsuleCollider
        args={[bodyHalfHeight, HOLLEN.body.radius]}
        position={[0, HOLLEN.body.height / 2, 0]}
      />
      <BallCollider
        ref={interactionSensor}
        args={[HOLLEN.interactionRadius]}
        position={[0, HOLLEN.body.height / 2, 0]}
        sensor
        onIntersectionEnter={({ other }) => {
          const playerCollider = playerStore.getState().collider
          if (playerCollider && other.collider.handle === playerCollider.handle)
            setNearby(true, true)
        }}
        onIntersectionExit={({ other }) => {
          const playerCollider = playerStore.getState().collider
          if (playerCollider && other.collider.handle === playerCollider.handle)
            setNearby(false, true)
        }}
      />
      <group
        ref={visual}
        position={[0, HOLLEN.body.height / 2, 0]}
        rotation={[0, roadFacing, 0]}
      >
        {/* PLACEHOLDER: Hollen uses a capsule until the M7 model pass. */}
        <mesh castShadow receiveShadow>
          <capsuleGeometry
            args={[
              HOLLEN.body.radius,
              bodyHalfHeight * 2,
              ENEMY_PRESENTATION.humanoid.bodyCapSegments,
              ENEMY_PRESENTATION.humanoid.bodyRadialSegments,
            ]}
          />
          <meshStandardMaterial
            color={HOLLEN.body.color}
            roughness={ENEMY_PRESENTATION.humanoid.bodyRoughness}
          />
        </mesh>
      </group>
      {interactionEnabled && !dialogueOpen && (
        <Html
          center
          position={[0, HOLLEN.body.height + HOLLEN.body.radius, 0]}
          className="interaction-prompt-anchor"
        >
          <div ref={prompt} className="interaction-prompt" hidden>
            {HOLLEN.prompt}
          </div>
        </Html>
      )}
    </RigidBody>
  )
}
