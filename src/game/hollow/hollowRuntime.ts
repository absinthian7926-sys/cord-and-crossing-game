import {
  consumeHollowClear,
  createHollowProgress,
  HOLLOW_FINAL_ENEMY_COUNT,
  HOLLOW_LAYOUT,
  markHeelstonePassDone,
  markSnagPulled,
  recordFinalEnemyDefeat,
  type HollowProgress,
} from './hollow'
import {
  beginSnagPull,
  createSnagState,
  MARKED_SNAG_POST_ID,
  stepSnag,
  type SnagState,
} from './snag'

export type HollowRuntimeSnapshot = {
  readonly progress: HollowProgress
  readonly snag: SnagState
  readonly revision: number
}

type HollowRuntimeListener = () => void
type HollowClearHandler = () => void

const listeners = new Set<HollowRuntimeListener>()
let hollowClearHandler: HollowClearHandler | null = null

function initialSnapshot(): HollowRuntimeSnapshot {
  return {
    progress: createHollowProgress(),
    snag: createSnagState(HOLLOW_LAYOUT.snagPost[0], HOLLOW_LAYOUT.snagPost[1]),
    revision: 0,
  }
}

let snapshot = initialSnapshot()

function publish(): void {
  snapshot = { ...snapshot, revision: snapshot.revision + 1 }
  for (const listener of listeners) listener()
}

function maybeDispatchHollowClear(): void {
  if (hollowClearHandler === null || !consumeHollowClear(snapshot.progress))
    return
  publish()
  hollowClearHandler()
}

export function getHollowRuntimeSnapshot(): HollowRuntimeSnapshot {
  return snapshot
}

export function subscribeHollowRuntime(
  listener: HollowRuntimeListener,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function resetHollowRuntime(): void {
  snapshot = initialSnapshot()
  for (const listener of listeners) listener()
}

export function registerHollowClearHandler(
  handler: HollowClearHandler | null,
): void {
  hollowClearHandler = handler
  maybeDispatchHollowClear()
}

export function hydrateHollowRuntime(
  heelstonePassDone: boolean,
  snagPulled: boolean,
  encounterDefeated: boolean,
): void {
  const next = initialSnapshot()
  next.progress.heelstonePassDone = heelstonePassDone
  next.progress.snagPulled = snagPulled
  next.progress.encounterDefeated = encounterDefeated
  if (encounterDefeated)
    next.progress.defeatedEnemyMask = (1 << HOLLOW_FINAL_ENEMY_COUNT) - 1
  if (snagPulled) {
    const offsetX = HOLLOW_LAYOUT.arrival[0] - next.snag.postX
    const offsetZ = HOLLOW_LAYOUT.arrival[2] - next.snag.postZ
    const inverseDistance =
      1 / Math.max(Number.EPSILON, Math.hypot(offsetX, offsetZ))
    next.snag.pulled = true
    next.snag.postX += offsetX * inverseDistance * HOLLOW_LAYOUT.snagDistance
    next.snag.postZ += offsetZ * inverseDistance * HOLLOW_LAYOUT.snagDistance
    next.snag.targetX = next.snag.postX
    next.snag.targetZ = next.snag.postZ
  }
  snapshot = next
  for (const listener of listeners) listener()
}

export function completeHollowHeelstonePass(): boolean {
  if (!markHeelstonePassDone(snapshot.progress)) return false
  publish()
  maybeDispatchHollowClear()
  return true
}

export function hitMarkedSnagPost(
  playerX: number,
  playerZ: number,
  baseSpeedMetersPerSecond: number,
  pullForceMultiplier: number,
): boolean {
  const started = beginSnagPull(
    snapshot.snag,
    MARKED_SNAG_POST_ID,
    playerX,
    playerZ,
    baseSpeedMetersPerSecond,
    pullForceMultiplier,
  )
  if (started) publish()
  return started
}

export function stepHollowSnag(dtSeconds: number): boolean {
  if (!stepSnag(snapshot.snag, dtSeconds)) return false
  markSnagPulled(snapshot.progress)
  publish()
  maybeDispatchHollowClear()
  return true
}

export function markHollowEnemyDefeated(enemyIndex: number): boolean {
  if (!recordFinalEnemyDefeat(snapshot.progress, enemyIndex)) return false
  publish()
  maybeDispatchHollowClear()
  return true
}
