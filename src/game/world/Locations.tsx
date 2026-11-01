import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  InstancedMesh,
  Line as ThreeLine,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { ZONE } from '../../data/zone'
import { ROAD_LENGTH, roadPointAt, sampleRoad } from './road'
import { heightAt } from './terrain'

const matrix = new Matrix4()
const position = new Vector3()
const rotation = new Quaternion()
const scale = new Vector3()

type Point = { x: number; y: number; z: number }

function buildRoad(): Mesh {
  const sampleCount = Math.ceil(ROAD_LENGTH / ZONE.road.sampleSpacing) + 1
  const samples = sampleRoad(new Float32Array(sampleCount * 2), sampleCount)
  const positions = new Float32Array(sampleCount * 2 * 3)
  const indices = new Uint32Array((sampleCount - 1) * 6)
  const halfWidth = ZONE.road.width / 2

  for (let index = 0; index < sampleCount; index += 1) {
    const previous = Math.max(0, index - 1)
    const next = Math.min(sampleCount - 1, index + 1)
    const x = samples[index * 2]
    const z = samples[index * 2 + 1]
    const dx = samples[next * 2] - samples[previous * 2]
    const dz = samples[next * 2 + 1] - samples[previous * 2 + 1]
    const inverseLength = 1 / Math.max(Number.EPSILON, Math.hypot(dx, dz))
    const offsetX = -dz * inverseLength * halfWidth
    const offsetZ = dx * inverseLength * halfWidth
    const y = heightAt(x, z) + ZONE.road.surfaceOffset
    const left = index * 6
    positions[left] = x + offsetX
    positions[left + 1] = y
    positions[left + 2] = z + offsetZ
    positions[left + 3] = x - offsetX
    positions[left + 4] = y
    positions[left + 5] = z - offsetZ
  }

  for (let index = 0; index < sampleCount - 1; index += 1) {
    const a = index * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    const offset = index * 6
    indices[offset] = a
    indices[offset + 1] = c
    indices[offset + 2] = b
    indices[offset + 3] = b
    indices[offset + 4] = c
    indices[offset + 5] = d
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(new BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  const material = new MeshStandardMaterial({
    color: ZONE.palette.road,
    roughness: 1,
  })
  const road = new Mesh(geometry, material)
  road.receiveShadow = true
  return road
}

function sampleCliffRail(): Point[] {
  const samples: Point[] = []
  const points = ZONE.cliffPath.points
  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const start = points[segment]
    const end = points[segment + 1]
    const dx = end[0] - start[0]
    const dz = end[1] - start[1]
    const length = Math.hypot(dx, dz)
    const count = Math.max(
      1,
      Math.ceil(length / ZONE.cliffPath.ropeRailPostSpacing),
    )
    for (let index = segment === 0 ? 0 : 1; index <= count; index += 1) {
      const progress = index / count
      const x = start[0] + dx * progress
      const z = start[1] + dz * progress
      samples.push({ x, y: heightAt(x, z), z })
    }
  }
  return samples
}

function buildRail(samples: Point[]): {
  posts: InstancedMesh
  rope: ThreeLine
} {
  const geometry = new CylinderGeometry(1, 1, 1, 6)
  const material = new MeshStandardMaterial({
    color: ZONE.palette.wood,
    roughness: 1,
  })
  const posts = new InstancedMesh(geometry, material, samples.length)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    position.set(
      sample.x,
      sample.y + ZONE.placeholders.cliffRail.postHeight / 2,
      sample.z,
    )
    rotation.identity()
    scale.set(
      ZONE.placeholders.cliffRail.postRadius,
      ZONE.placeholders.cliffRail.postHeight,
      ZONE.placeholders.cliffRail.postRadius,
    )
    matrix.compose(position, rotation, scale)
    posts.setMatrixAt(index, matrix)
  }
  posts.instanceMatrix.needsUpdate = true
  posts.computeBoundingBox()
  posts.computeBoundingSphere()
  posts.castShadow = true

  const ropePositions = new Float32Array(samples.length * 3)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    const offset = index * 3
    ropePositions[offset] = sample.x
    ropePositions[offset + 1] =
      sample.y + ZONE.placeholders.cliffRail.ropeHeight
    ropePositions[offset + 2] = sample.z
  }
  const ropeGeometry = new BufferGeometry()
  ropeGeometry.setAttribute('position', new BufferAttribute(ropePositions, 3))
  const rope = new ThreeLine(
    ropeGeometry,
    new LineBasicMaterial({ color: ZONE.palette.rope }),
  )
  return { posts, rope }
}

function Waystation() {
  const data = ZONE.placeholders.waystation
  const centerX = ZONE.locations.A.center[0] + data.shelterCenter[0]
  const centerZ = ZONE.locations.A.center[1] + data.shelterCenter[1]
  const ground = heightAt(centerX, centerZ)
  const halfX = data.shelterSize[0] / 2
  const halfY = data.shelterSize[1] / 2
  const halfZ = data.shelterSize[2] / 2
  const barrelX = ZONE.locations.A.center[0] + data.barrelOffset[0]
  const barrelZ = ZONE.locations.A.center[1] + data.barrelOffset[1]
  const markerX = ZONE.locations.A.center[0] + data.npcMarkerOffset[0]
  const markerZ = ZONE.locations.A.center[1] + data.npcMarkerOffset[1]

  return (
    <group name="location-a-waystation">
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[halfX, data.postRadius, halfZ]}
          position={[centerX, ground + data.shelterSize[1], centerZ]}
        />
        {[-1, 1].flatMap((xSign) =>
          [-1, 1].map((zSign) => (
            <CuboidCollider
              key={`${xSign}-${zSign}`}
              args={[data.postRadius, halfY, data.postRadius]}
              position={[
                centerX + xSign * halfX,
                ground + halfY,
                centerZ + zSign * halfZ,
              ]}
            />
          )),
        )}
      </RigidBody>
      <mesh
        castShadow
        receiveShadow
        position={[centerX, ground + data.shelterSize[1], centerZ]}
      >
        <boxGeometry
          args={[data.shelterSize[0], data.postRadius * 2, data.shelterSize[2]]}
        />
        <meshStandardMaterial color={ZONE.palette.wood} roughness={1} />
      </mesh>
      {[-1, 1].flatMap((xSign) =>
        [-1, 1].map((zSign) => (
          <mesh
            key={`${xSign}-${zSign}`}
            castShadow
            position={[
              centerX + xSign * halfX,
              ground + halfY,
              centerZ + zSign * halfZ,
            ]}
          >
            <cylinderGeometry
              args={[data.postRadius, data.postRadius, data.shelterSize[1], 6]}
            />
            <meshStandardMaterial color={ZONE.palette.wood} roughness={1} />
          </mesh>
        )),
      )}
      <mesh
        castShadow
        position={[
          barrelX,
          heightAt(barrelX, barrelZ) + data.barrelHeight / 2,
          barrelZ,
        ]}
      >
        <cylinderGeometry
          args={[data.barrelRadius, data.barrelRadius, data.barrelHeight, 10]}
        />
        <meshStandardMaterial color={ZONE.palette.wood} roughness={1} />
      </mesh>
      {/* PLACEHOLDER: empty marker for the later quest NPC. */}
      <mesh
        position={[
          markerX,
          heightAt(markerX, markerZ) + data.postRadius,
          markerZ,
        ]}
      >
        <cylinderGeometry
          args={[
            data.npcMarkerRadius,
            data.npcMarkerRadius,
            data.postRadius,
            16,
          ]}
        />
        <meshStandardMaterial color={ZONE.palette.npcMarker} roughness={1} />
      </mesh>
    </group>
  )
}

function WreckedCart({ distance }: { distance: number }) {
  const cart = ZONE.placeholders.cart
  const point = roadPointAt(distance / ROAD_LENGTH, { x: 0, z: 0 })
  const next = roadPointAt((distance + ZONE.road.sampleSpacing) / ROAD_LENGTH, {
    x: 0,
    z: 0,
  })
  const yaw = -Math.atan2(next.z - point.z, next.x - point.x)
  const ground = heightAt(point.x, point.z)
  const half = cart.bodySize.map((value) => value / 2) as [
    number,
    number,
    number,
  ]
  const wheelX = cart.bodySize[0] / 3

  return (
    <group
      name="wrecked-cart"
      position={[point.x, ground, point.z]}
      rotation={[0, yaw, 0]}
    >
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={half} position={[0, half[1], 0]} />
      </RigidBody>
      <mesh castShadow receiveShadow position={[0, half[1], 0]}>
        <boxGeometry args={cart.bodySize} />
        <meshStandardMaterial color={ZONE.palette.wood} roughness={1} />
      </mesh>
      {[-1, 1].flatMap((xSign) =>
        [-1, 1].map((zSign) => (
          <mesh
            key={`${xSign}-${zSign}`}
            castShadow
            position={[xSign * wheelX, cart.wheelRadius, zSign * half[2]]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry
              args={[cart.wheelRadius, cart.wheelRadius, cart.wheelWidth, 10]}
            />
            <meshStandardMaterial color={ZONE.palette.wood} roughness={1} />
          </mesh>
        )),
      )}
    </group>
  )
}

function BrigandCamp() {
  const center = ZONE.locations.D.center
  const camp = ZONE.placeholders.camp
  const halfTent = camp.tentSize.map((value) => value / 2) as [
    number,
    number,
    number,
  ]
  const lookoutX = center[0] + camp.lookoutOffset[0]
  const lookoutZ = center[1] + camp.lookoutOffset[1]
  const lookoutGround = heightAt(lookoutX, lookoutZ)

  return (
    <group name="location-d-brigand-camp">
      {camp.tentOffsets.map((offset, index) => {
        const x = center[0] + offset[0]
        const z = center[1] + offset[1]
        const y = heightAt(x, z)
        return (
          <RigidBody key={index} type="fixed" colliders={false}>
            <CuboidCollider
              args={halfTent}
              position={[x, y + halfTent[1], z]}
            />
            <mesh castShadow position={[x, y + halfTent[1], z]}>
              <boxGeometry args={camp.tentSize} />
              <meshStandardMaterial color={ZONE.palette.tent} roughness={1} />
            </mesh>
          </RigidBody>
        )
      })}
      <mesh
        position={[
          center[0] + camp.fireOffset[0],
          heightAt(
            center[0] + camp.fireOffset[0],
            center[1] + camp.fireOffset[1],
          ) + camp.fireRadius,
          center[1] + camp.fireOffset[1],
        ]}
      >
        <coneGeometry args={[camp.fireRadius, camp.fireRadius * 2, 6]} />
        <meshStandardMaterial
          color={ZONE.palette.fire}
          emissive={ZONE.palette.fire}
          emissiveIntensity={1}
        />
        <pointLight
          color={ZONE.palette.fire}
          intensity={1}
          distance={camp.glowRange}
        />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[
            camp.lookoutSize[0] / 2,
            camp.lookoutSize[1] / 2,
            camp.lookoutSize[2] / 2,
          ]}
          position={[
            lookoutX,
            lookoutGround + camp.lookoutSize[1] / 2,
            lookoutZ,
          ]}
        />
        <mesh
          castShadow
          position={[
            lookoutX,
            lookoutGround + camp.lookoutSize[1] / 2,
            lookoutZ,
          ]}
        >
          <boxGeometry args={camp.lookoutSize} />
          <meshStandardMaterial color={ZONE.palette.wood} roughness={1} />
        </mesh>
      </RigidBody>
    </group>
  )
}

function RuinShelf() {
  const ruin = ZONE.placeholders.ruin
  const center = ZONE.locations.E.center
  const ground = heightAt(center[0], center[1])
  const pillarHalf = ruin.pillarSize.map((value) => value / 2) as [
    number,
    number,
    number,
  ]

  return (
    <group name="location-e-ruin-shelf">
      {ruin.frameOffsets.map((offset, index) => {
        const framePosition: [number, number, number] = [
          center[0] + offset[0],
          ground + ruin.frameSize[1] / 2,
          center[1] + offset[1],
        ]
        return (
          <RigidBody key={index} type="fixed" colliders={false}>
            <CuboidCollider
              args={[
                ruin.frameSize[0] / 2,
                ruin.frameSize[1] / 2,
                ruin.frameSize[2] / 2,
              ]}
              position={framePosition}
            />
            <mesh castShadow position={framePosition}>
              <boxGeometry args={ruin.frameSize} />
              <meshStandardMaterial color={ZONE.palette.stone} roughness={1} />
            </mesh>
          </RigidBody>
        )
      })}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[
            ruin.lintelSize[0] / 2,
            ruin.lintelSize[1] / 2,
            ruin.lintelSize[2] / 2,
          ]}
          position={[
            center[0],
            ground + ruin.frameSize[1],
            center[1] + ruin.frameOffsets[2][1],
          ]}
        />
        <mesh
          castShadow
          position={[
            center[0],
            ground + ruin.frameSize[1],
            center[1] + ruin.frameOffsets[2][1],
          ]}
        >
          <boxGeometry args={ruin.lintelSize} />
          <meshStandardMaterial color={ZONE.palette.stone} roughness={1} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="inert-portico-pillars">
        {[-1, 1].map((side) => {
          const x =
            ruin.porticoCenter[0] + (side * ZONE.portico.pillarSpacing) / 2
          const z = ruin.porticoCenter[1]
          return (
            <CuboidCollider
              key={side}
              args={pillarHalf}
              position={[x, heightAt(x, z) + pillarHalf[1], z]}
            />
          )
        })}
      </RigidBody>
      {[-1, 1].map((side) => {
        const x =
          ruin.porticoCenter[0] + (side * ZONE.portico.pillarSpacing) / 2
        const z = ruin.porticoCenter[1]
        return (
          <mesh
            key={side}
            castShadow
            position={[x, heightAt(x, z) + pillarHalf[1], z]}
          >
            <boxGeometry args={ruin.pillarSize} />
            <meshStandardMaterial color={ZONE.palette.stone} roughness={1} />
          </mesh>
        )
      })}
    </group>
  )
}

export function Locations() {
  const road = useMemo(buildRoad, [])
  const railSamples = useMemo(sampleCliffRail, [])
  const rail = useMemo(() => buildRail(railSamples), [railSamples])

  useEffect(
    () => () => {
      road.geometry.dispose()
      ;(road.material as MeshStandardMaterial).dispose()
      rail.posts.geometry.dispose()
      ;(rail.posts.material as MeshStandardMaterial).dispose()
      rail.rope.geometry.dispose()
      ;(rail.rope.material as LineBasicMaterial).dispose()
    },
    [rail, road],
  )

  return (
    <>
      <primitive object={road} />
      <Waystation />
      {ZONE.road.wreckDistances.map((distance) => (
        <WreckedCart key={distance} distance={distance} />
      ))}
      <group name="location-c-cliff-path-rail">
        <primitive object={rail.posts} />
        <primitive object={rail.rope} />
        <RigidBody type="fixed" colliders={false}>
          {railSamples.map((sample, index) => (
            <CuboidCollider
              key={`post-${index}`}
              args={[
                ZONE.placeholders.cliffRail.postRadius,
                ZONE.placeholders.cliffRail.postHeight / 2,
                ZONE.placeholders.cliffRail.postRadius,
              ]}
              position={[
                sample.x,
                sample.y + ZONE.placeholders.cliffRail.postHeight / 2,
                sample.z,
              ]}
            />
          ))}
          {railSamples.slice(0, -1).map((sample, index) => {
            const next = railSamples[index + 1]
            const dx = next.x - sample.x
            const dz = next.z - sample.z
            const length = Math.hypot(dx, dz)
            return (
              <CuboidCollider
                key={`rope-${index}`}
                args={[
                  length / 2,
                  ZONE.placeholders.cliffRail.postRadius,
                  ZONE.placeholders.cliffRail.postRadius,
                ]}
                position={[
                  (sample.x + next.x) / 2,
                  (sample.y + next.y) / 2 +
                    ZONE.placeholders.cliffRail.ropeHeight,
                  (sample.z + next.z) / 2,
                ]}
                rotation={[0, -Math.atan2(dz, dx), 0]}
              />
            )
          })}
        </RigidBody>
      </group>
      <BrigandCamp />
      <RuinShelf />
    </>
  )
}
