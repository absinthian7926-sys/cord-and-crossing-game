import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  BallCollider,
  RigidBody,
  type RapierCollider,
} from '@react-three/rapier'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { FRAME_SHELTER_KEY } from '../../data/quests'
import { ModelSlot } from '../models/ModelSlot'
import {
  registerCameraExcludedCollider,
  unregisterCameraExcludedCollider,
} from '../player/cameraCollisionRegistry'
import { playerStore } from '../player/playerStore'
import {
  getQuestRuntimeSnapshot,
  setKeyNearby,
  setKeyNearbyTransient,
  subscribeQuestRuntime,
} from './questRuntime'
import { isWithinKeyPickupRadius } from './keyDrop'

export function FrameShelterKey() {
  const snapshot = useSyncExternalStore(
    subscribeQuestRuntime,
    getQuestRuntimeSnapshot,
    getQuestRuntimeSnapshot,
  )
  const sensor = useRef<RapierCollider>(null)
  const prompt = useRef<HTMLDivElement>(null)
  const nearby = useRef(false)

  useEffect(() => {
    const collider = sensor.current
    if (!collider) return
    registerCameraExcludedCollider(collider.handle)
    return () => {
      unregisterCameraExcludedCollider(collider.handle)
      setKeyNearby(false)
      setKeyNearbyTransient(false)
    }
  }, [snapshot.keyDrop])

  const drop = snapshot.keyDrop
  useFrame(() => {
    if (drop === null) return
    const player = playerStore.getState().position
    const isNearby = isWithinKeyPickupRadius(player.x, player.z, drop.x, drop.z)
    if (nearby.current !== isNearby) {
      nearby.current = isNearby
      setKeyNearbyTransient(isNearby)
    }
    if (prompt.current) prompt.current.hidden = !isNearby
  })
  if (drop === null) return null

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={[drop.x, drop.y, drop.z]}
      name="frame-shelter-key"
    >
      <BallCollider
        ref={sensor}
        args={[FRAME_SHELTER_KEY.pickupRadius]}
        sensor
        onIntersectionEnter={({ other }) => {
          const playerCollider = playerStore.getState().collider
          if (
            playerCollider &&
            other.collider.handle === playerCollider.handle
          ) {
            nearby.current = true
            if (prompt.current) prompt.current.hidden = false
            setKeyNearby(true)
          }
        }}
        onIntersectionExit={({ other }) => {
          const playerCollider = playerStore.getState().collider
          if (
            playerCollider &&
            other.collider.handle === playerCollider.handle
          ) {
            nearby.current = false
            if (prompt.current) prompt.current.hidden = true
            setKeyNearby(false)
          }
        }}
      />
      <ModelSlot
        model="frameShelterKey"
        fallback={
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry
              args={[
                FRAME_SHELTER_KEY.presentation.ringRadius,
                FRAME_SHELTER_KEY.presentation.tubeRadius,
                FRAME_SHELTER_KEY.presentation.radialSegments,
                FRAME_SHELTER_KEY.presentation.tubularSegments,
              ]}
            />
            <meshStandardMaterial
              color={FRAME_SHELTER_KEY.presentation.color}
              metalness={FRAME_SHELTER_KEY.presentation.metalness}
              roughness={FRAME_SHELTER_KEY.presentation.roughness}
              emissive={FRAME_SHELTER_KEY.presentation.glowColor}
              emissiveIntensity={FRAME_SHELTER_KEY.presentation.glowIntensity}
            />
          </mesh>
        }
      />
      <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={3}>
        <torusGeometry
          args={[
            FRAME_SHELTER_KEY.presentation.markerRingRadius,
            FRAME_SHELTER_KEY.presentation.markerTubeRadius,
            FRAME_SHELTER_KEY.presentation.radialSegments,
            FRAME_SHELTER_KEY.presentation.tubularSegments,
          ]}
        />
        <meshStandardMaterial
          color={FRAME_SHELTER_KEY.presentation.glowColor}
          emissive={FRAME_SHELTER_KEY.presentation.glowColor}
          emissiveIntensity={FRAME_SHELTER_KEY.presentation.glowIntensity}
          roughness={FRAME_SHELTER_KEY.presentation.roughness}
          metalness={FRAME_SHELTER_KEY.presentation.metalness}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[0, FRAME_SHELTER_KEY.presentation.beamHeight * 0.5, 0]}
        renderOrder={2}
      >
        <cylinderGeometry
          args={[
            FRAME_SHELTER_KEY.presentation.beamRadius,
            FRAME_SHELTER_KEY.presentation.beamRadius,
            FRAME_SHELTER_KEY.presentation.beamHeight,
            FRAME_SHELTER_KEY.presentation.tubularSegments,
          ]}
        />
        <meshBasicMaterial
          color={FRAME_SHELTER_KEY.presentation.glowColor}
          transparent
          opacity={FRAME_SHELTER_KEY.presentation.beamOpacity}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        color={FRAME_SHELTER_KEY.presentation.glowColor}
        intensity={FRAME_SHELTER_KEY.presentation.glowIntensity}
        distance={FRAME_SHELTER_KEY.presentation.glowRange}
      />
      <Html
        center
        position={[0, FRAME_SHELTER_KEY.pickupRadius, 0]}
        className="interaction-prompt-anchor"
      >
        <div ref={prompt} className="interaction-prompt" hidden>
          {FRAME_SHELTER_KEY.prompt}
        </div>
      </Html>
    </RigidBody>
  )
}
