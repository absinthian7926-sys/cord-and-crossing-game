import { ZONE, type QualityLevel } from '../../data/zone'
import { distanceToRoad } from './road'
import { heightAt } from './terrain'

export type ScatterKind = 'rocks' | 'scrub'

export type ScatterBuffer = {
  positions: Float32Array
  scales: Float32Array
  rotations: Float32Array
  variants: Uint8Array
  count: number
}

const locationFootprints = Object.values(ZONE.locations)

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a)
  let right = Math.abs(b)
  while (right !== 0) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left
}

function nextRandom(state: Uint32Array): number {
  let value = state[0]
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  state[0] = value >>> 0
  return state[0] / 4_294_967_296
}

export function scatterCountForQuality(
  kind: ScatterKind,
  quality: QualityLevel,
): number {
  return Math.round(
    ZONE.scatter.mediumCounts[kind] * ZONE.scatter.densityByQuality[quality],
  )
}

export function createScatterBuffer(capacity: number): ScatterBuffer {
  if (!Number.isInteger(capacity) || capacity < 0)
    throw new RangeError('capacity must be a non-negative integer')
  return {
    positions: new Float32Array(capacity * 3),
    scales: new Float32Array(capacity),
    rotations: new Float32Array(capacity),
    variants: new Uint8Array(capacity),
    count: 0,
  }
}

export function isInsideLocationFootprint(x: number, z: number): boolean {
  for (const location of locationFootprints) {
    const dx = x - location.center[0]
    const dz = z - location.center[1]
    if (dx * dx + dz * dz < location.radius * location.radius) return true
  }
  return false
}

export function isScatterPointAllowed(x: number, z: number): boolean {
  const { bounds } = ZONE
  if (
    x < bounds.minimumX ||
    x > bounds.maximumX ||
    z < bounds.minimumZ ||
    z > bounds.maximumZ
  )
    return false
  if (heightAt(x, z) <= ZONE.sea.level) return false
  if (distanceToRoad(x, z) < ZONE.road.scatterExclusionRadius) return false
  const safeDx = x - ZONE.locations.A.center[0]
  const safeDz = z - ZONE.locations.A.center[1]
  if (
    safeDx * safeDx + safeDz * safeDz <
    ZONE.locations.A.radius * ZONE.locations.A.radius
  )
    return false
  return !isInsideLocationFootprint(x, z)
}

export function fillScatter(
  target: ScatterBuffer,
  kind: ScatterKind,
  seed: number = ZONE.scatter.seeds[kind],
): ScatterBuffer {
  const capacity = target.scales.length
  if (
    target.positions.length < capacity * 3 ||
    target.rotations.length < capacity ||
    target.variants.length < capacity
  )
    throw new RangeError('scatter buffer arrays have inconsistent capacities')

  const state = new Uint32Array([seed === 0 ? 0x9e3779b9 : seed >>> 0])
  const { bounds } = ZONE
  const width = bounds.maximumX - bounds.minimumX
  const depth = bounds.maximumZ - bounds.minimumZ
  const cellCount = Math.max(1, Math.ceil(capacity * 1.4))
  const columns = Math.ceil(Math.sqrt((cellCount * width) / depth))
  const rows = Math.ceil(cellCount / columns)
  const availableCells = columns * rows
  const cellWidth = width / columns
  const cellDepth = depth / rows
  let step = Math.max(1, ((seed * 2 + 1) >>> 0) % availableCells)
  while (greatestCommonDivisor(step, availableCells) !== 1) step += 1
  const offset = Math.floor(nextRandom(state) * availableCells)
  const scaleRange =
    kind === 'rocks' ? ZONE.scatter.rockScale : ZONE.scatter.scrubScale
  const variantCount = ZONE.scatter.variants[kind]
  const maximumAttempts = availableCells * 8
  let accepted = 0

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const cell = (offset + attempt * step) % availableCells
    const column = cell % columns
    const row = Math.floor(cell / columns)
    const x = bounds.minimumX + (column + nextRandom(state)) * cellWidth
    const z = bounds.minimumZ + (row + nextRandom(state)) * cellDepth
    if (!isScatterPointAllowed(x, z)) continue

    const positionOffset = accepted * 3
    target.positions[positionOffset] = x
    target.positions[positionOffset + 1] = heightAt(x, z)
    target.positions[positionOffset + 2] = z
    target.scales[accepted] =
      scaleRange[0] + (scaleRange[1] - scaleRange[0]) * nextRandom(state)
    target.rotations[accepted] = nextRandom(state) * Math.PI * 2
    target.variants[accepted] = Math.floor(nextRandom(state) * variantCount)
    accepted += 1
    if (accepted === capacity) break
  }

  if (accepted !== capacity)
    throw new Error(`unable to place ${capacity} ${kind}; placed ${accepted}`)
  target.count = accepted
  return target
}

export function generateScatter(
  kind: ScatterKind,
  quality: QualityLevel = ZONE.quality.default,
): ScatterBuffer {
  const target = createScatterBuffer(scatterCountForQuality(kind, quality))
  return fillScatter(target, kind)
}
