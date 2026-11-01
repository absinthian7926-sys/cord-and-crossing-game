import { ZONE } from '../../data/zone'
import { distanceToRoad, roadProgressAt } from './road'

const { bounds, heightmap, locations, sea } = ZONE

export const TERRAIN_WIDTH = bounds.maximumX - bounds.minimumX
export const TERRAIN_DEPTH = bounds.maximumZ - bounds.minimumZ
export const TERRAIN_CELL_SIZE = TERRAIN_WIDTH / (ZONE.heightmap.resolution - 1)

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
const smooth01 = (value: number): number => {
  const clamped = clamp01(value)
  return clamped * clamped * (3 - 2 * clamped)
}

function hashLattice(x: number, z: number, seed: number): number {
  let value = Math.imul(x, 374_761_393)
  value =
    (value + Math.imul(z, 668_265_263) + Math.imul(seed, 2_147_483_647)) | 0
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177)
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_295
}

function valueNoise(x: number, z: number, scale: number, seed: number): number {
  const scaledX = x / scale
  const scaledZ = z / scale
  const x0 = Math.floor(scaledX)
  const z0 = Math.floor(scaledZ)
  const tx = smooth01(scaledX - x0)
  const tz = smooth01(scaledZ - z0)
  const a = hashLattice(x0, z0, seed)
  const b = hashLattice(x0 + 1, z0, seed)
  const c = hashLattice(x0, z0 + 1, seed)
  const d = hashLattice(x0 + 1, z0 + 1, seed)
  const north = a + (b - a) * tx
  const south = c + (d - c) * tx
  return (north + (south - north) * tz) * 2 - 1
}

function radialBlend(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  flatRadius: number,
  feather: number,
): number {
  const distance = Math.hypot(x - centerX, z - centerZ)
  if (distance <= flatRadius) return 1
  if (distance >= flatRadius + feather) return 0
  return 1 - smooth01((distance - flatRadius) / feather)
}

function rawHeight(x: number, z: number): number {
  const coastProgress = smooth01(
    (x - sea.coastX) / (sea.plateauStartX - sea.coastX),
  )
  const coastalPlateau = -6 + coastProgress * 14
  const eastRise = smooth01(x / locations.E.center[0]) * 40
  const broadNoise =
    valueNoise(x, z, heightmap.noiseScale, heightmap.seed) *
    heightmap.noiseAmplitude
  const detailNoise =
    valueNoise(x, z, heightmap.detailScale, heightmap.seed + 17) *
    heightmap.detailAmplitude
  const northShoulder = smooth01((-z - 60) / 440) * 1.5
  return coastalPlateau + eastRise + broadNoise + detailNoise + northShoulder
}

export function heightAt(x: number, z: number): number {
  let height = rawHeight(x, z)
  if (x <= sea.coastX) height = Math.min(height, sea.level - 1)

  const roadDistance = distanceToRoad(x, z)
  if (roadDistance < ZONE.road.flattenRadius) {
    const roadHeight =
      heightmap.waystationHeight +
      (heightmap.ruinShelfHeight - 3 - heightmap.waystationHeight) *
        roadProgressAt(x, z)
    const roadBlend = 1 - smooth01(roadDistance / ZONE.road.flattenRadius)
    height += (roadHeight - height) * roadBlend
  }

  const campBlend = radialBlend(
    x,
    z,
    locations.D.center[0],
    locations.D.center[1],
    locations.D.radius,
    18,
  )
  height += (heightmap.campHeight - height) * campBlend

  const waystationBlend = radialBlend(
    x,
    z,
    locations.A.center[0],
    locations.A.center[1],
    locations.A.radius,
    18,
  )
  height += (heightmap.waystationHeight - height) * waystationBlend

  const shelfBlend = radialBlend(
    x,
    z,
    locations.E.center[0],
    locations.E.center[1],
    locations.E.radius,
    18,
  )
  height += (heightmap.ruinShelfHeight - height) * shelfBlend

  return Math.max(-8, Math.min(heightmap.maximumHeight, height))
}

export function worldXForGridIndex(
  index: number,
  resolution: number = heightmap.resolution,
): number {
  return bounds.minimumX + (index / (resolution - 1)) * TERRAIN_WIDTH
}

export function worldZForGridIndex(
  index: number,
  resolution: number = heightmap.resolution,
): number {
  return bounds.minimumZ + (index / (resolution - 1)) * TERRAIN_DEPTH
}

export function heightGridIndex(
  xIndex: number,
  zIndex: number,
  resolution: number = heightmap.resolution,
): number {
  return zIndex * resolution + xIndex
}

export function fillHeightGrid(
  target: Float32Array,
  resolution: number = heightmap.resolution,
): Float32Array {
  const requiredLength = resolution * resolution
  if (resolution < 2) throw new RangeError('resolution must be at least 2')
  if (target.length < requiredLength)
    throw new RangeError('target is too small for the height grid')

  for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
    const z = worldZForGridIndex(zIndex, resolution)
    for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
      const x = worldXForGridIndex(xIndex, resolution)
      target[heightGridIndex(xIndex, zIndex, resolution)] = heightAt(x, z)
    }
  }
  return target
}

export function fillColumnMajorHeightGrid(
  source: Float32Array,
  target: Float32Array,
  resolution: number = heightmap.resolution,
): Float32Array {
  const requiredLength = resolution * resolution
  if (source.length < requiredLength || target.length < requiredLength)
    throw new RangeError('height grid is too small for column-major conversion')

  for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
    for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
      target[xIndex * resolution + zIndex] =
        source[heightGridIndex(xIndex, zIndex, resolution)]
    }
  }
  return target
}
