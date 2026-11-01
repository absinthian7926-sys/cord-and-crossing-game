import { describe, expect, it } from 'vitest'
import { ZONE } from '../data/zone'
import { roadPointAt } from '../game/world/road'
import {
  fillColumnMajorHeightGrid,
  fillHeightGrid,
  heightAt,
  heightGridIndex,
  worldXForGridIndex,
  worldZForGridIndex,
} from '../game/world/terrain'

describe('Saltwind Rise terrain', () => {
  it('is deterministic and finite throughout the zone bounds', () => {
    const first = heightAt(237.5, -164.25)
    expect(heightAt(237.5, -164.25)).toBe(first)
    for (let zIndex = 0; zIndex <= 20; zIndex += 1) {
      const z =
        ZONE.bounds.minimumZ +
        (zIndex / 20) * (ZONE.bounds.maximumZ - ZONE.bounds.minimumZ)
      for (let xIndex = 0; xIndex <= 20; xIndex += 1) {
        const x =
          ZONE.bounds.minimumX +
          (xIndex / 20) * (ZONE.bounds.maximumX - ZONE.bounds.minimumX)
        expect(Number.isFinite(heightAt(x, z))).toBe(true)
      }
    }
  })

  it('flattens the waystation, road and camp', () => {
    expect(heightAt(0, 0)).toBeCloseTo(ZONE.heightmap.waystationHeight)
    expect(heightAt(10, 8)).toBeCloseTo(ZONE.heightmap.waystationHeight)
    expect(heightAt(380, -240)).toBeCloseTo(ZONE.heightmap.campHeight)
    expect(heightAt(400, -230)).toBeCloseTo(ZONE.heightmap.campHeight)

    const point = { x: 0, z: 0 }
    for (const progress of [0.2, 0.4, 0.6, 0.8]) {
      roadPointAt(progress, point)
      const expected =
        ZONE.heightmap.waystationHeight +
        (ZONE.heightmap.ruinShelfHeight - 3 - ZONE.heightmap.waystationHeight) *
          progress
      expect(heightAt(point.x, point.z)).toBeCloseTo(expected, 4)
    }
  })

  it('drops below the sea in the west and rises highest at the Ruin Shelf', () => {
    for (const z of [-500, -250, 0, 250, 500])
      expect(heightAt(ZONE.bounds.minimumX, z)).toBeLessThan(ZONE.sea.level)
    const ruinHeight = heightAt(
      ZONE.locations.E.center[0],
      ZONE.locations.E.center[1],
    )
    expect(ruinHeight).toBeCloseTo(ZONE.heightmap.ruinShelfHeight)
    expect(ruinHeight).toBeGreaterThan(heightAt(0, 0))
    expect(ruinHeight).toBeGreaterThan(heightAt(380, -240))
  })

  it('fills a preallocated grid with heightAt samples', () => {
    const resolution = 17
    const grid = new Float32Array(resolution * resolution)
    expect(fillHeightGrid(grid, resolution)).toBe(grid)
    for (const [xIndex, zIndex] of [
      [0, 0],
      [8, 8],
      [16, 16],
      [12, 4],
    ] as const) {
      const expected = heightAt(
        worldXForGridIndex(xIndex, resolution),
        worldZForGridIndex(zIndex, resolution),
      )
      expect(grid[heightGridIndex(xIndex, zIndex, resolution)]).toBeCloseTo(
        expected,
        4,
      )
    }
  })

  it('converts the visual grid to Rapier column-major order', () => {
    const resolution = 5
    const visualGrid = fillHeightGrid(
      new Float32Array(resolution * resolution),
      resolution,
    )
    const colliderGrid = new Float32Array(visualGrid.length)
    expect(
      fillColumnMajorHeightGrid(visualGrid, colliderGrid, resolution),
    ).toBe(colliderGrid)

    const xIndex = 3
    const zIndex = 1
    expect(colliderGrid[xIndex * resolution + zIndex]).toBe(
      visualGrid[heightGridIndex(xIndex, zIndex, resolution)],
    )
    expect(colliderGrid[xIndex * resolution + zIndex]).toBeCloseTo(
      heightAt(
        worldXForGridIndex(xIndex, resolution),
        worldZForGridIndex(zIndex, resolution),
      ),
      4,
    )
  })
})
