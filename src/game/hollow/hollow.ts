import { ZONE } from '../../data/zone'

export const HOLLOW_LAYOUT = ZONE.hollow
export const HOLLOW_FINAL_ENEMY_COUNT = HOLLOW_LAYOUT.encounterOffsets.length
export const HOLLOW_GATE_HALF_EXTENTS = [
  HOLLOW_LAYOUT.blockedGapWidth / 2,
  HOLLOW_LAYOUT.presentation.gate.height / 2,
  HOLLOW_LAYOUT.presentation.gate.thickness / 2,
] as const
export const HOLLOW_SIDE_BARRIER_HALF_WIDTH =
  (HOLLOW_LAYOUT.size - HOLLOW_LAYOUT.blockedGapWidth) / 4
export const HOLLOW_SIDE_BARRIER_CENTER_OFFSET =
  HOLLOW_LAYOUT.blockedGapWidth / 2 + HOLLOW_SIDE_BARRIER_HALF_WIDTH

export type HollowProgress = {
  heelstonePassDone: boolean
  snagPulled: boolean
  encounterDefeated: boolean
  defeatedEnemyMask: number
  questEventEmitted: boolean
}

export function isFinalEncounterSpawnInsideBounds(index: number): boolean {
  const offset = HOLLOW_LAYOUT.encounterOffsets[index]
  if (!offset) return false
  const x = HOLLOW_LAYOUT.encounterCenter[0] + offset[0]
  const z = HOLLOW_LAYOUT.encounterCenter[1] + offset[1]
  return (
    x >= HOLLOW_LAYOUT.bounds.minimumX &&
    x <= HOLLOW_LAYOUT.bounds.maximumX &&
    z >= HOLLOW_LAYOUT.bounds.minimumZ &&
    z <= HOLLOW_LAYOUT.bounds.maximumZ
  )
}

export function isSnagBarrierBlockingPoint(
  x: number,
  z: number,
  gatePulled: boolean,
): boolean {
  const offsetX = Math.abs(x - HOLLOW_LAYOUT.snagPost[0])
  const offsetZ = Math.abs(z - HOLLOW_LAYOUT.snagPost[1])
  if (offsetZ > HOLLOW_GATE_HALF_EXTENTS[2]) return false
  if (x < HOLLOW_LAYOUT.bounds.minimumX || x > HOLLOW_LAYOUT.bounds.maximumX)
    return false
  return !gatePulled || offsetX > HOLLOW_GATE_HALF_EXTENTS[0]
}

export function createHollowProgress(): HollowProgress {
  return {
    heelstonePassDone: false,
    snagPulled: false,
    encounterDefeated: false,
    defeatedEnemyMask: 0,
    questEventEmitted: false,
  }
}

export function markHeelstonePassDone(progress: HollowProgress): boolean {
  if (progress.heelstonePassDone) return false
  progress.heelstonePassDone = true
  return true
}

export function markSnagPulled(progress: HollowProgress): boolean {
  if (progress.snagPulled) return false
  progress.snagPulled = true
  return true
}

export function recordFinalEnemyDefeat(
  progress: HollowProgress,
  enemyIndex: number,
): boolean {
  if (
    progress.encounterDefeated ||
    enemyIndex < 0 ||
    enemyIndex >= HOLLOW_FINAL_ENEMY_COUNT
  )
    return false
  const bit = 1 << enemyIndex
  if ((progress.defeatedEnemyMask & bit) !== 0) return false
  progress.defeatedEnemyMask |= bit
  const completeMask = (1 << HOLLOW_FINAL_ENEMY_COUNT) - 1
  if (progress.defeatedEnemyMask === completeMask)
    progress.encounterDefeated = true
  return true
}

export function isHollowClearReady(progress: HollowProgress): boolean {
  return (
    progress.heelstonePassDone &&
    progress.snagPulled &&
    progress.encounterDefeated
  )
}

export function consumeHollowClear(progress: HollowProgress): boolean {
  if (!isHollowClearReady(progress) || progress.questEventEmitted) return false
  progress.questEventEmitted = true
  return true
}
