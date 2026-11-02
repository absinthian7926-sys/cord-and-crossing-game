import { ZONE } from '../../data/zone'

export const MARKED_SNAG_POST_ID = 'marked-snag-post'
export const SNAG_PULL_DISTANCE = ZONE.hollow.snagDistance

export type SnagState = {
  postX: number
  postZ: number
  startX: number
  startZ: number
  targetX: number
  targetZ: number
  travelled: number
  speedMetersPerSecond: number
  pulling: boolean
  pulled: boolean
}

export function createSnagState(postX: number, postZ: number): SnagState {
  return {
    postX,
    postZ,
    startX: postX,
    startZ: postZ,
    targetX: postX,
    targetZ: postZ,
    travelled: 0,
    speedMetersPerSecond: 0,
    pulling: false,
    pulled: false,
  }
}

export function beginSnagPull(
  state: SnagState,
  targetId: string,
  playerX: number,
  playerZ: number,
  baseSpeedMetersPerSecond: number,
  pullForceMultiplier: number,
): boolean {
  if (
    targetId !== MARKED_SNAG_POST_ID ||
    state.pulling ||
    state.pulled ||
    baseSpeedMetersPerSecond <= 0 ||
    pullForceMultiplier <= 0
  )
    return false

  const offsetX = playerX - state.postX
  const offsetZ = playerZ - state.postZ
  const distance = Math.hypot(offsetX, offsetZ)
  if (distance <= Number.EPSILON) return false

  state.startX = state.postX
  state.startZ = state.postZ
  state.targetX = state.postX + (offsetX / distance) * SNAG_PULL_DISTANCE
  state.targetZ = state.postZ + (offsetZ / distance) * SNAG_PULL_DISTANCE
  state.travelled = 0
  state.speedMetersPerSecond = baseSpeedMetersPerSecond * pullForceMultiplier
  state.pulling = true
  return true
}

export function stepSnag(state: SnagState, dtSeconds: number): boolean {
  if (!state.pulling || dtSeconds <= 0) return false

  state.travelled = Math.min(
    SNAG_PULL_DISTANCE,
    state.travelled + state.speedMetersPerSecond * dtSeconds,
  )
  const progress = state.travelled / SNAG_PULL_DISTANCE
  state.postX = state.startX + (state.targetX - state.startX) * progress
  state.postZ = state.startZ + (state.targetZ - state.startZ) * progress

  if (state.travelled < SNAG_PULL_DISTANCE) return false
  state.postX = state.targetX
  state.postZ = state.targetZ
  state.pulling = false
  state.pulled = true
  return true
}
