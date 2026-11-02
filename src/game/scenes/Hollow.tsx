import {
  BallCollider,
  CuboidCollider,
  RigidBody,
  useBeforePhysicsStep,
  type RapierCollider,
} from '@react-three/rapier'
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import type { Group } from 'three'
import { REACHBLADE } from '../../data/weapons'
import { ZONE } from '../../data/zone'
import {
  HOLLOW_GATE_HALF_EXTENTS,
  HOLLOW_SIDE_BARRIER_CENTER_OFFSET,
  HOLLOW_SIDE_BARRIER_HALF_WIDTH,
} from '../hollow/hollow'
import {
  getHollowRuntimeSnapshot,
  stepHollowSnag,
  subscribeHollowRuntime,
} from '../hollow/hollowRuntime'
import {
  registerCameraExcludedCollider,
  unregisterCameraExcludedCollider,
} from '../player/cameraCollisionRegistry'
import { Portico } from '../portico/Portico'
import type { PorticoDirection } from '../portico/porticoRuntime'

export type HollowProps = {
  readonly children?: ReactNode
  readonly onReturnCrossing?: (direction: PorticoDirection) => void
}

const presentation = ZONE.hollow.presentation

function PracticeRail() {
  const [x, z] = ZONE.hollow.practiceRail
  const rail = presentation.practiceRail
  return (
    <group position={[x, ZONE.hollow.groundHeight, z]} name="practice-rail">
      {/* PLACEHOLDER: practice rail uses low-poly stone and rope forms. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          castShadow
          position={[side * rail.postOffsetX, rail.postHeight / 2, 0]}
        >
          <cylinderGeometry
            args={[
              rail.postTopRadius,
              rail.postBottomRadius,
              rail.postHeight,
              rail.postRadialSegments,
            ]}
          />
          <meshStandardMaterial
            color={ZONE.palette.wood}
            roughness={presentation.roughness}
          />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0, rail.ropeHeight, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry
          args={[
            rail.ropeRadius,
            rail.ropeRadius,
            rail.ropeLength,
            rail.ropeRadialSegments,
          ]}
        />
        <meshStandardMaterial
          color={ZONE.palette.rope}
          roughness={presentation.roughness}
        />
      </mesh>
    </group>
  )
}

function TargetPost() {
  const [x, z] = ZONE.hollow.targetPost
  const target = presentation.targetPost
  return (
    <group position={[x, ZONE.hollow.groundHeight, z]} name="target-post">
      {/* PLACEHOLDER: target post uses simple wood primitives. */}
      <mesh castShadow position={[0, target.postHeight / 2, 0]}>
        <cylinderGeometry
          args={[
            target.postTopRadius,
            target.postBottomRadius,
            target.postHeight,
            target.postRadialSegments,
          ]}
        />
        <meshStandardMaterial
          color={ZONE.palette.wood}
          roughness={presentation.roughness}
        />
      </mesh>
      <mesh
        castShadow
        position={[0, target.targetHeight, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry
          args={[
            target.targetRadius,
            target.targetRadius,
            target.targetDepth,
            target.targetRadialSegments,
          ]}
        />
        <meshStandardMaterial
          color={ZONE.palette.stone}
          roughness={presentation.roughness}
        />
      </mesh>
    </group>
  )
}

function SnagPost() {
  const sensor = useRef<RapierCollider>(null)
  const visual = useRef<Group>(null)
  const initialX = ZONE.hollow.snagPost[0]
  const initialZ = ZONE.hollow.snagPost[1]
  const postPresentation = presentation.snagPost

  useEffect(() => {
    const collider = sensor.current
    if (!collider) return
    registerCameraExcludedCollider(collider.handle)
    return () => unregisterCameraExcludedCollider(collider.handle)
  }, [])

  useBeforePhysicsStep(() => {
    stepHollowSnag(1 / 60)
    const post = getHollowRuntimeSnapshot().snag
    if (visual.current)
      visual.current.position.set(
        post.postX,
        ZONE.hollow.groundHeight,
        post.postZ,
      )
  })

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <BallCollider
          ref={sensor}
          args={[REACHBLADE.bladeHitRadius]}
          position={[initialX, postPresentation.centerHeight, initialZ]}
          sensor
        />
      </RigidBody>
      <group ref={visual} name="marked-snag-post">
        {/* PLACEHOLDER: marked loose post uses stone and hemp primitives. */}
        <mesh castShadow position={[0, postPresentation.centerHeight, 0]}>
          <cylinderGeometry
            args={[
              postPresentation.topRadius,
              postPresentation.bottomRadius,
              postPresentation.height,
              postPresentation.radialSegments,
            ]}
          />
          <meshStandardMaterial
            color={ZONE.palette.stone}
            roughness={presentation.roughness}
          />
        </mesh>
        <mesh
          castShadow
          position={[0, postPresentation.ringHeight, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <torusGeometry
            args={[
              postPresentation.ringRadius,
              postPresentation.ringTubeRadius,
              postPresentation.ringRadialSegments,
              postPresentation.ringTubularSegments,
            ]}
          />
          <meshStandardMaterial
            color={ZONE.palette.rope}
            roughness={presentation.roughness}
          />
        </mesh>
      </group>
    </>
  )
}

function SnagGate() {
  const snapshot = useSyncExternalStore(
    subscribeHollowRuntime,
    getHollowRuntimeSnapshot,
    getHollowRuntimeSnapshot,
  )
  if (snapshot.progress.snagPulled) return null
  const [x, z] = ZONE.hollow.snagPost
  const [halfWidth, halfHeight, halfThickness] = HOLLOW_GATE_HALF_EXTENTS
  return (
    <RigidBody type="fixed" colliders={false} name="snag-gate">
      <CuboidCollider
        args={[halfWidth, halfHeight, halfThickness]}
        position={[x, halfHeight, z]}
      />
      {/* PLACEHOLDER: a simple stone gate marks the blocked path. */}
      <mesh castShadow receiveShadow position={[x, halfHeight, z]}>
        <boxGeometry
          args={[halfWidth * 2, halfHeight * 2, halfThickness * 2]}
        />
        <meshStandardMaterial
          color={ZONE.palette.stone}
          roughness={presentation.roughness}
        />
      </mesh>
    </RigidBody>
  )
}

function SnagBarrierWalls() {
  const [x, z] = ZONE.hollow.snagPost
  const halfHeight = presentation.gate.height / 2
  const halfThickness = presentation.gate.thickness / 2
  return (
    <RigidBody type="fixed" colliders={false} name="snag-barrier-walls">
      {[-1, 1].map((side) => {
        const centerX = x + side * HOLLOW_SIDE_BARRIER_CENTER_OFFSET
        return (
          <group key={side}>
            <CuboidCollider
              args={[HOLLOW_SIDE_BARRIER_HALF_WIDTH, halfHeight, halfThickness]}
              position={[centerX, halfHeight, z]}
            />
            {/* PLACEHOLDER: stone shoulders make the snag gate the only path. */}
            <mesh castShadow receiveShadow position={[centerX, halfHeight, z]}>
              <boxGeometry
                args={[
                  HOLLOW_SIDE_BARRIER_HALF_WIDTH * 2,
                  halfHeight * 2,
                  halfThickness * 2,
                ]}
              />
              <meshStandardMaterial
                color={ZONE.palette.stone}
                roughness={presentation.roughness}
              />
            </mesh>
          </group>
        )
      })}
    </RigidBody>
  )
}

function EncounterMarkers() {
  const [centerX, centerZ] = ZONE.hollow.encounterCenter
  return (
    <group name="final-encounter-staging">
      {ZONE.hollow.encounterOffsets.map(([offsetX, offsetZ], index) => (
        <mesh
          key={index}
          position={[
            centerX + offsetX,
            ZONE.hollow.groundHeight +
              presentation.encounterMarker.groundOffset,
            centerZ + offsetZ,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {/* PLACEHOLDER: hidden by final encounter bodies once wired. */}
          <circleGeometry
            args={[
              presentation.encounterMarker.radius,
              presentation.encounterMarker.segments,
            ]}
          />
          <meshStandardMaterial
            color={ZONE.palette.road}
            roughness={presentation.roughness}
          />
        </mesh>
      ))}
    </group>
  )
}

function HollowBounds() {
  const half = ZONE.hollow.size / 2
  const wallHeight = ZONE.boundary.wallHeight
  const wallThickness = ZONE.boundary.wallThickness
  const groundHalfDepth = presentation.groundColliderHalfDepth
  return (
    <RigidBody type="fixed" colliders={false} name="hollow-bounds">
      <CuboidCollider
        args={[half, groundHalfDepth, half]}
        position={[0, ZONE.hollow.groundHeight - groundHalfDepth, 0]}
      />
      <CuboidCollider
        args={[wallThickness / 2, wallHeight / 2, half]}
        position={[-half, wallHeight / 2, 0]}
      />
      <CuboidCollider
        args={[wallThickness / 2, wallHeight / 2, half]}
        position={[half, wallHeight / 2, 0]}
      />
      <CuboidCollider
        args={[half, wallHeight / 2, wallThickness / 2]}
        position={[0, wallHeight / 2, -half]}
      />
      <CuboidCollider
        args={[half, wallHeight / 2, wallThickness / 2]}
        position={[0, wallHeight / 2, half]}
      />
    </RigidBody>
  )
}

function ShelterWalls() {
  const half = ZONE.hollow.size / 2
  const wall = presentation.shelterWalls
  const halfHeight = wall.height / 2
  return (
    <group name="sheltered-stone-hollow">
      {/* PLACEHOLDER: low stone walls establish the sheltered Hollow form. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`x-${side}`}
          castShadow
          receiveShadow
          position={[side * half, halfHeight, 0]}
        >
          <boxGeometry args={[wall.thickness, wall.height, ZONE.hollow.size]} />
          <meshStandardMaterial
            color={ZONE.palette.stone}
            roughness={presentation.roughness}
          />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`z-${side}`}
          castShadow
          receiveShadow
          position={[0, halfHeight, side * half]}
        >
          <boxGeometry args={[ZONE.hollow.size, wall.height, wall.thickness]} />
          <meshStandardMaterial
            color={ZONE.palette.stone}
            roughness={presentation.roughness}
          />
        </mesh>
      ))}
    </group>
  )
}

export function Hollow({ children, onReturnCrossing }: HollowProps) {
  const [porticoX, porticoZ] = ZONE.hollow.porticoCenter
  const normal = ZONE.hollow.porticoNormal
  return (
    <>
      <color attach="background" args={[ZONE.fog.color]} />
      <fog
        attach="fog"
        args={[ZONE.fog.color, presentation.fogStart, presentation.fogEnd]}
      />
      <ambientLight intensity={presentation.ambientIntensity} />
      <directionalLight
        castShadow
        color={ZONE.lighting.sunColor}
        intensity={presentation.sunIntensity}
        position={presentation.sunPosition}
      />
      <HollowBounds />
      <ShelterWalls />
      <mesh
        receiveShadow
        position={[0, ZONE.hollow.groundHeight, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[ZONE.hollow.size, ZONE.hollow.size]} />
        <meshStandardMaterial
          color={ZONE.hollow.groundColor}
          roughness={presentation.roughness}
        />
      </mesh>
      <Portico
        kind="hollow"
        center={[porticoX, ZONE.hollow.groundHeight, porticoZ]}
        normal={[normal[0], normal[1], normal[2]]}
        active
        onValidCrossing={onReturnCrossing}
      />
      <PracticeRail />
      <TargetPost />
      <SnagPost />
      <SnagBarrierWalls />
      <SnagGate />
      <EncounterMarkers />
      {children}
    </>
  )
}

export default Hollow
