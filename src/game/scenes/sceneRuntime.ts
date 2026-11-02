import { PLAYER } from '../../data/player'
import { ZONE } from '../../data/zone'
import { activateEnemyScene } from '../enemies/enemyRuntime'
import { playerStore } from '../player/playerStore'
import { heightAt } from '../world/terrain'

export type GameScene = 'zone' | 'hollow'

export type WorldConfiguration = {
  readonly scene: GameScene
  readonly sampleHeight: (x: number, z: number) => number
  readonly bounds: {
    readonly minimumX: number
    readonly maximumX: number
    readonly minimumZ: number
    readonly maximumZ: number
  }
  readonly respawn: {
    readonly x: number
    readonly y: number
    readonly z: number
  }
  readonly hasSea: boolean
  readonly safeZoneEnabled: boolean
  readonly trainingDummiesEnabled: boolean
}

export type SceneRuntimeSnapshot = {
  readonly currentScene: GameScene
  readonly pendingScene: GameScene | null
  readonly phase: 'idle' | 'flashing' | 'loading'
  readonly revision: number
  readonly transitionStartedMilliseconds: number | null
  readonly lastLoadMilliseconds: number | null
}

type Listener = () => void

const PLAYER_GROUND_OFFSET = PLAYER.collider.halfHeight + PLAYER.collider.radius

export const ZONE_WORLD: WorldConfiguration = {
  scene: 'zone',
  sampleHeight: heightAt,
  bounds: ZONE.bounds,
  respawn: { x: ZONE.spawn[0], y: ZONE.spawn[1], z: ZONE.spawn[2] },
  hasSea: true,
  safeZoneEnabled: true,
  trainingDummiesEnabled: true,
}

export function hollowHeightAt(): number {
  return ZONE.hollow.groundHeight
}

export const HOLLOW_WORLD: WorldConfiguration = {
  scene: 'hollow',
  sampleHeight: hollowHeightAt,
  bounds: ZONE.hollow.bounds,
  respawn: {
    x: ZONE.hollow.arrival[0],
    y: ZONE.hollow.arrival[1],
    z: ZONE.hollow.arrival[2],
  },
  hasSea: false,
  safeZoneEnabled: false,
  trainingDummiesEnabled: false,
}

const listeners = new Set<Listener>()
let transitionArrival: { x: number; y: number; z: number } = {
  x: ZONE.spawn[0],
  y: ZONE.spawn[1],
  z: ZONE.spawn[2],
}
let snapshot: SceneRuntimeSnapshot = {
  currentScene: 'zone',
  pendingScene: null,
  phase: 'idle',
  revision: 0,
  transitionStartedMilliseconds: null,
  lastLoadMilliseconds: null,
}

function publish(next: SceneRuntimeSnapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

function placePlayer(x: number, y: number, z: number): void {
  const store = playerStore.getState()
  store.position.x = x
  store.position.y = y + PLAYER_GROUND_OFFSET
  store.position.z = z
  store.teleportTarget = {
    x: store.position.x,
    y: store.position.y,
    z: store.position.z,
  }
}

export function getSceneRuntimeSnapshot(): SceneRuntimeSnapshot {
  return snapshot
}

export function subscribeSceneRuntime(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getWorldConfiguration(
  scene: GameScene = snapshot.currentScene,
): WorldConfiguration {
  return scene === 'hollow' ? HOLLOW_WORLD : ZONE_WORLD
}

export function requestSceneTransition(
  scene: GameScene,
  x: number,
  y: number,
  z: number,
  nowMilliseconds = performance.now(),
): boolean {
  if (snapshot.pendingScene !== null || snapshot.currentScene === scene)
    return false
  transitionArrival = { x, y, z }
  publish({
    ...snapshot,
    pendingScene: scene,
    phase: 'flashing',
    revision: snapshot.revision + 1,
    transitionStartedMilliseconds: nowMilliseconds,
  })
  return true
}

export function beginPendingSceneLoad(): boolean {
  if (snapshot.pendingScene === null || snapshot.phase !== 'flashing')
    return false
  const nextScene = snapshot.pendingScene
  activateEnemyScene(nextScene)
  placePlayer(transitionArrival.x, transitionArrival.y, transitionArrival.z)
  publish({
    ...snapshot,
    currentScene: nextScene,
    pendingScene: null,
    phase: 'loading',
    revision: snapshot.revision + 1,
  })
  return true
}

export function markSceneReady(nowMilliseconds = performance.now()): void {
  if (snapshot.phase !== 'loading') return
  const started = snapshot.transitionStartedMilliseconds
  publish({
    ...snapshot,
    phase: 'idle',
    revision: snapshot.revision + 1,
    transitionStartedMilliseconds: null,
    lastLoadMilliseconds:
      started === null ? null : Math.max(0, nowMilliseconds - started),
  })
}

export function loadSceneImmediately(
  scene: GameScene,
  x?: number,
  y?: number,
  z?: number,
): void {
  const world = getWorldConfiguration(scene)
  activateEnemyScene(scene)
  placePlayer(x ?? world.respawn.x, y ?? world.respawn.y, z ?? world.respawn.z)
  publish({
    currentScene: scene,
    pendingScene: null,
    phase: 'idle',
    revision: snapshot.revision + 1,
    transitionStartedMilliseconds: null,
    lastLoadMilliseconds: snapshot.lastLoadMilliseconds,
  })
}

export function resetSceneRuntime(): void {
  loadSceneImmediately('zone', ZONE.spawn[0], ZONE.spawn[1], ZONE.spawn[2])
}
