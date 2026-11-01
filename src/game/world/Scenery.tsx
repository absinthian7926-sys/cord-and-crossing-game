import { BallCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import {
  ConeGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from 'three'
import { ZONE } from '../../data/zone'
import { distanceToCliffPath, distanceToRoad } from './road'
import {
  generateScatter,
  type ScatterBuffer,
  type ScatterKind,
} from './scatter'

type ScatterMeshes = {
  buffer: ScatterBuffer
  meshes: InstancedMesh[]
  geometries: BufferGeometry[]
  materials: MeshStandardMaterial[]
}

const matrix = new Matrix4()
const position = new Vector3()
const scale = new Vector3()
const rotation = new Quaternion()
const up = new Vector3(0, 1, 0)

function buildScatterMeshes(
  kind: ScatterKind,
  variantCount: number,
  colors: readonly string[],
): ScatterMeshes {
  const buffer = generateScatter(kind)
  const counts = new Uint32Array(variantCount)
  for (let index = 0; index < buffer.count; index += 1)
    counts[buffer.variants[index]] += 1

  const geometries: BufferGeometry[] = []
  const materials: MeshStandardMaterial[] = []
  const meshes: InstancedMesh[] = []
  for (let variant = 0; variant < variantCount; variant += 1) {
    const geometry =
      kind === 'rocks'
        ? variant === 0
          ? new DodecahedronGeometry(1, 0)
          : variant === 1
            ? new IcosahedronGeometry(1, 0)
            : new OctahedronGeometry(1, 0)
        : new ConeGeometry(1, 1, variant === 0 ? 5 : 6)
    const material = new MeshStandardMaterial({
      color: colors[variant],
      roughness: 1,
    })
    const mesh = new InstancedMesh(geometry, material, counts[variant])
    mesh.castShadow = kind === 'rocks'
    mesh.receiveShadow = true
    mesh.frustumCulled = true
    geometries.push(geometry)
    materials.push(material)
    meshes.push(mesh)
  }

  const instanceOffsets = new Uint32Array(variantCount)
  for (let index = 0; index < buffer.count; index += 1) {
    const sourceOffset = index * 3
    const variant = buffer.variants[index]
    const mesh = meshes[variant]
    position.set(
      buffer.positions[sourceOffset],
      buffer.positions[sourceOffset + 1] +
        (kind === 'rocks' ? buffer.scales[index] : 0),
      buffer.positions[sourceOffset + 2],
    )
    rotation.setFromAxisAngle(up, buffer.rotations[index])
    scale.setScalar(buffer.scales[index])
    matrix.compose(position, rotation, scale)
    mesh.setMatrixAt(instanceOffsets[variant], matrix)
    instanceOffsets[variant] += 1
  }
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
  }

  return { buffer, meshes, geometries, materials }
}

export function Scenery() {
  const rocks = useMemo(
    () =>
      buildScatterMeshes(
        'rocks',
        ZONE.scatter.variants.rocks,
        ZONE.palette.rock,
      ),
    [],
  )
  const scrub = useMemo(
    () =>
      buildScatterMeshes(
        'scrub',
        ZONE.scatter.variants.scrub,
        ZONE.palette.scrub,
      ),
    [],
  )
  const largeRockColliders = useMemo(() => {
    const colliders: { x: number; y: number; z: number; radius: number }[] = []
    for (let index = 0; index < rocks.buffer.count; index += 1) {
      const radius = rocks.buffer.scales[index]
      if (radius < ZONE.scatter.largeRockMinimumScale) continue
      const offset = index * 3
      const x = rocks.buffer.positions[offset]
      const y = rocks.buffer.positions[offset + 1]
      const z = rocks.buffer.positions[offset + 2]
      if (
        distanceToRoad(x, z) <= ZONE.scatter.colliderPathDistance ||
        distanceToCliffPath(x, z) <= ZONE.scatter.colliderPathDistance
      ) {
        colliders.push({ x, y: y + radius, z, radius })
      }
    }
    return colliders
  }, [rocks])

  useEffect(
    () => () => {
      for (const collection of [rocks, scrub]) {
        for (const mesh of collection.meshes) mesh.dispose()
        for (const geometry of collection.geometries) geometry.dispose()
        for (const material of collection.materials) material.dispose()
      }
    },
    [rocks, scrub],
  )

  return (
    <>
      <group name="instanced-scenery">
        {rocks.meshes.map((mesh, index) => (
          <primitive key={`rock-${index}`} object={mesh} />
        ))}
        {scrub.meshes.map((mesh, index) => (
          <primitive key={`scrub-${index}`} object={mesh} />
        ))}
      </group>
      <RigidBody type="fixed" colliders={false} name="large-rock-colliders">
        {largeRockColliders.map((rock, index) => (
          <BallCollider
            key={index}
            args={[rock.radius]}
            position={[rock.x, rock.y, rock.z]}
          />
        ))}
      </RigidBody>
    </>
  )
}
