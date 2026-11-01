import {
  CuboidCollider,
  HeightfieldCollider,
  RigidBody,
} from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  LOD,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { ZONE } from '../../data/zone'
import {
  fillColumnMajorHeightGrid,
  fillHeightGrid,
  heightGridIndex,
  TERRAIN_DEPTH,
  TERRAIN_WIDTH,
  worldXForGridIndex,
  worldZForGridIndex,
} from './terrain'

function createChunkGeometry(
  grid: Float32Array,
  startX: number,
  startZ: number,
  cells: number,
  step: number,
  centerX: number,
  centerZ: number,
): BufferGeometry {
  const resolution = ZONE.heightmap.resolution
  const cellsPerSide = Math.floor(cells / step)
  const verticesPerSide = cellsPerSide + 1
  const positions = new Float32Array(verticesPerSide * verticesPerSide * 3)
  const uvs = new Float32Array(verticesPerSide * verticesPerSide * 2)
  const indices = new Uint32Array(cellsPerSide * cellsPerSide * 6)

  for (let z = 0; z < verticesPerSide; z += 1) {
    const gridZ = startZ + z * step
    for (let x = 0; x < verticesPerSide; x += 1) {
      const gridX = startX + x * step
      const vertex = z * verticesPerSide + x
      const positionOffset = vertex * 3
      positions[positionOffset] = worldXForGridIndex(gridX) - centerX
      positions[positionOffset + 1] =
        grid[heightGridIndex(gridX, gridZ, resolution)]
      positions[positionOffset + 2] = worldZForGridIndex(gridZ) - centerZ
      const uvOffset = vertex * 2
      uvs[uvOffset] = gridX / (resolution - 1)
      uvs[uvOffset + 1] = gridZ / (resolution - 1)
    }
  }

  let indexOffset = 0
  for (let z = 0; z < cellsPerSide; z += 1) {
    for (let x = 0; x < cellsPerSide; x += 1) {
      const a = z * verticesPerSide + x
      const b = a + 1
      const c = a + verticesPerSide
      const d = c + 1
      indices[indexOffset] = a
      indices[indexOffset + 1] = c
      indices[indexOffset + 2] = b
      indices[indexOffset + 3] = b
      indices[indexOffset + 4] = c
      indices[indexOffset + 5] = d
      indexOffset += 6
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex(new BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function Terrain() {
  const terrain = useMemo(() => {
    const resolution = ZONE.heightmap.resolution
    const grid = fillHeightGrid(new Float32Array(resolution * resolution))
    const colliderGrid = fillColumnMajorHeightGrid(
      grid,
      new Float32Array(grid.length),
      resolution,
    )
    const material = new MeshStandardMaterial({
      color: ZONE.palette.terrain,
      roughness: 1,
    })
    const chunksPerSide = (resolution - 1) / ZONE.heightmap.chunkCells
    const lods: LOD[] = []

    for (let chunkZ = 0; chunkZ < chunksPerSide; chunkZ += 1) {
      for (let chunkX = 0; chunkX < chunksPerSide; chunkX += 1) {
        const startX = chunkX * ZONE.heightmap.chunkCells
        const startZ = chunkZ * ZONE.heightmap.chunkCells
        const endX = startX + ZONE.heightmap.chunkCells
        const endZ = startZ + ZONE.heightmap.chunkCells
        const centerX =
          (worldXForGridIndex(startX) + worldXForGridIndex(endX)) / 2
        const centerZ =
          (worldZForGridIndex(startZ) + worldZForGridIndex(endZ)) / 2
        const highGeometry = createChunkGeometry(
          grid,
          startX,
          startZ,
          ZONE.heightmap.chunkCells,
          1,
          centerX,
          centerZ,
        )
        const lowGeometry = createChunkGeometry(
          grid,
          startX,
          startZ,
          ZONE.heightmap.chunkCells,
          ZONE.heightmap.lodLevels,
          centerX,
          centerZ,
        )
        const high = new Mesh(highGeometry, material)
        const low = new Mesh(lowGeometry, material)
        high.receiveShadow = true
        low.receiveShadow = true
        high.frustumCulled = true
        low.frustumCulled = true
        const lod = new LOD()
        lod.position.set(centerX, 0, centerZ)
        lod.addLevel(high, 0)
        lod.addLevel(low, ZONE.heightmap.lodDistance)
        lods.push(lod)
      }
    }

    return {
      colliderHeights: Array.from(colliderGrid),
      lods,
      material,
    }
  }, [])

  useEffect(
    () => () => {
      for (const lod of terrain.lods) {
        for (const level of lod.levels) {
          const mesh = level.object as Mesh
          mesh.geometry.dispose()
        }
      }
      terrain.material.dispose()
    },
    [terrain],
  )

  const centerX = (ZONE.bounds.minimumX + ZONE.bounds.maximumX) / 2
  const centerZ = (ZONE.bounds.minimumZ + ZONE.bounds.maximumZ) / 2
  const halfWallHeight = ZONE.boundary.wallHeight / 2
  const halfWallThickness = ZONE.boundary.wallThickness / 2
  const halfWidth = TERRAIN_WIDTH / 2
  const halfDepth = TERRAIN_DEPTH / 2

  return (
    <>
      <group name="terrain-chunks">
        {terrain.lods.map((lod, index) => (
          <primitive key={index} object={lod} />
        ))}
      </group>
      <RigidBody
        type="fixed"
        colliders={false}
        position={[centerX, 0, centerZ]}
        name="terrain-heightfield"
      >
        <HeightfieldCollider
          args={[
            ZONE.heightmap.resolution - 1,
            ZONE.heightmap.resolution - 1,
            terrain.colliderHeights,
            { x: TERRAIN_WIDTH, y: 1, z: TERRAIN_DEPTH },
          ]}
        />
      </RigidBody>
      <RigidBody type="fixed" colliders={false} name="zone-boundaries">
        <CuboidCollider
          args={[halfWallThickness, halfWallHeight, halfDepth]}
          position={[
            ZONE.bounds.minimumX - halfWallThickness,
            halfWallHeight,
            centerZ,
          ]}
        />
        <CuboidCollider
          args={[halfWallThickness, halfWallHeight, halfDepth]}
          position={[
            ZONE.bounds.maximumX + halfWallThickness,
            halfWallHeight,
            centerZ,
          ]}
        />
        <CuboidCollider
          args={[halfWidth, halfWallHeight, halfWallThickness]}
          position={[
            centerX,
            halfWallHeight,
            ZONE.bounds.minimumZ - halfWallThickness,
          ]}
        />
        <CuboidCollider
          args={[halfWidth, halfWallHeight, halfWallThickness]}
          position={[
            centerX,
            halfWallHeight,
            ZONE.bounds.maximumZ + halfWallThickness,
          ]}
        />
      </RigidBody>
    </>
  )
}
