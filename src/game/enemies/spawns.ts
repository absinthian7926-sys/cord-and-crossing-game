import {
  ENEMY_DEATH,
  ENEMY_SPAWNS,
  ENEMY_TYPES,
  type EnemyType,
} from '../../data/enemies'
import { ROAD_LENGTH, roadPointAt, type MutablePoint2 } from '../world/road'

export type SpawnGroup =
  'camp' | 'cliff-pack-1' | 'cliff-pack-2' | 'road-patrol'

export type SpawnDefinition = {
  id: string
  enemyType: EnemyType
  group: SpawnGroup
  x: number
  z: number
  anchorX: number
  anchorZ: number
  patrolStartX: number
  patrolStartZ: number
  patrolEndX: number
  patrolEndZ: number
}

function addCampSpawns(
  target: SpawnDefinition[],
  enemyType: EnemyType,
  count: number,
  firstOrdinal: number,
  totalCount: number,
): void {
  const camp = ENEMY_SPAWNS.camp
  for (let index = 0; index < count; index += 1) {
    const ordinal = firstOrdinal + index
    const angle = (Math.PI * 2 * ordinal) / totalCount
    const radius = (camp.spreadRadius * (ordinal + 1)) / (totalCount + 1)
    const x = camp.anchor[0] + Math.cos(angle) * radius
    const z = camp.anchor[1] + Math.sin(angle) * radius
    target.push({
      id: `camp-${enemyType}-${index + 1}`,
      enemyType,
      group: 'camp',
      x,
      z,
      anchorX: x,
      anchorZ: z,
      patrolStartX: x,
      patrolStartZ: z,
      patrolEndX: x,
      patrolEndZ: z,
    })
  }
}

function addHoundPacks(target: SpawnDefinition[]): void {
  for (
    let packIndex = 0;
    packIndex < ENEMY_SPAWNS.houndPacks.length;
    packIndex += 1
  ) {
    const pack = ENEMY_SPAWNS.houndPacks[packIndex]
    const group = `cliff-pack-${packIndex + 1}` as SpawnGroup
    for (let memberIndex = 0; memberIndex < pack.size; memberIndex += 1) {
      const offset =
        (memberIndex - (pack.size - 1) / 2) *
        ENEMY_TYPES.cliffHound.collider.length
      const x = pack.anchor[0] + offset
      const z = pack.anchor[1]
      target.push({
        id: `cliff-hound-${packIndex + 1}-${memberIndex + 1}`,
        enemyType: 'cliffHound',
        group,
        x,
        z,
        anchorX: x,
        anchorZ: z,
        patrolStartX: x,
        patrolStartZ: z,
        patrolEndX: x,
        patrolEndZ: z,
      })
    }
  }
}

function roadPointAtDistance(distance: number, out: MutablePoint2): void {
  roadPointAt(distance / ROAD_LENGTH, out)
}

function addRoadPatrol(target: SpawnDefinition[]): void {
  const routeStart = { x: 0, z: 0 }
  const routeEnd = { x: 0, z: 0 }
  roadPointAtDistance(ENEMY_SPAWNS.roadPatrol.routeDistances[0], routeStart)
  roadPointAtDistance(ENEMY_SPAWNS.roadPatrol.routeDistances[1], routeEnd)

  const addMember = (enemyType: EnemyType, index: number, atEnd: boolean) => {
    const point = atEnd ? routeEnd : routeStart
    target.push({
      id: `road-patrol-${enemyType}-${index + 1}`,
      enemyType,
      group: 'road-patrol',
      x: point.x,
      z: point.z,
      anchorX: point.x,
      anchorZ: point.z,
      patrolStartX: routeStart.x,
      patrolStartZ: routeStart.z,
      patrolEndX: routeEnd.x,
      patrolEndZ: routeEnd.z,
    })
  }

  for (
    let index = 0;
    index < ENEMY_SPAWNS.roadPatrol.roadBrigands;
    index += 1
  ) {
    addMember('roadBrigand', index, index % 2 === 1)
  }
  for (
    let index = 0;
    index < ENEMY_SPAWNS.roadPatrol.brigandArchers;
    index += 1
  ) {
    addMember('brigandArcher', index, true)
  }
}

export function createSpawnPlan(): SpawnDefinition[] {
  const target: SpawnDefinition[] = []
  const campTotal =
    ENEMY_SPAWNS.camp.roadBrigands + ENEMY_SPAWNS.camp.brigandArchers
  addCampSpawns(
    target,
    'roadBrigand',
    ENEMY_SPAWNS.camp.roadBrigands,
    0,
    campTotal,
  )
  addCampSpawns(
    target,
    'brigandArcher',
    ENEMY_SPAWNS.camp.brigandArchers,
    ENEMY_SPAWNS.camp.roadBrigands,
    campTotal,
  )
  addHoundPacks(target)
  addRoadPatrol(target)
  return target
}

export type RespawnState = {
  dead: boolean
  remainingSeconds: number
}

export function createRespawnState(): RespawnState {
  return { dead: false, remainingSeconds: 0 }
}

export function advanceRespawnElapsed(
  elapsedSeconds: number,
  dtSeconds: number,
): number {
  return Math.max(0, elapsedSeconds) + Math.max(0, dtSeconds)
}

export function canRespawnFromElapsed(
  elapsedSeconds: number,
  playerDistanceFromAnchor: number,
): boolean {
  return (
    elapsedSeconds >= ENEMY_DEATH.respawnSeconds &&
    playerDistanceFromAnchor > ENEMY_DEATH.respawnPlayerDistance
  )
}

export function markEnemyDead(state: RespawnState): void {
  state.dead = true
  state.remainingSeconds = ENEMY_DEATH.respawnSeconds
}

export function advanceRespawn(
  state: RespawnState,
  dtSeconds: number,
  playerDistanceFromAnchor: number,
): boolean {
  if (!state.dead) return false
  state.remainingSeconds = Math.max(
    0,
    state.remainingSeconds - Math.max(0, dtSeconds),
  )
  if (
    state.remainingSeconds === 0 &&
    playerDistanceFromAnchor > ENEMY_DEATH.respawnPlayerDistance
  ) {
    state.dead = false
    return true
  }
  return false
}
