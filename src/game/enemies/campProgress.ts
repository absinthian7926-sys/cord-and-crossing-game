import { CAMP_PROGRESS } from '../../data/enemies'

export const STANDARD_CAMP_ENEMY_IDS = [
  'camp-roadBrigand-1',
  'camp-roadBrigand-2',
  'camp-roadBrigand-3',
  'camp-roadBrigand-4',
  'camp-roadBrigand-5',
  'camp-roadBrigand-6',
  'camp-brigandArcher-1',
  'camp-brigandArcher-2',
  'camp-brigandArcher-3',
] as const

export type StandardCampEnemyId = (typeof STANDARD_CAMP_ENEMY_IDS)[number]

export type MutablePoint2 = { x: number; z: number }

export function isCampQuestActive(
  questStep: number,
  keyLooted: boolean,
): boolean {
  return questStep === 2 && !keyLooted
}

export function isStandardCampEnemyId(
  enemyId: string,
): enemyId is StandardCampEnemyId {
  for (let index = 0; index < STANDARD_CAMP_ENEMY_IDS.length; index += 1) {
    if (STANDARD_CAMP_ENEMY_IDS[index] === enemyId) return true
  }
  return false
}

export function shouldHoldCampRespawn(
  enemyId: string,
  questStep: number,
  keyLooted: boolean,
): boolean {
  return (
    isStandardCampEnemyId(enemyId) && isCampQuestActive(questStep, keyLooted)
  )
}

export function shouldSetCampCheckpoint(
  questStep: number,
  keyLooted: boolean,
  distanceToCamp: number,
): boolean {
  return (
    isCampQuestActive(questStep, keyLooted) &&
    distanceToCamp <= CAMP_PROGRESS.checkpointRadius
  )
}

export function resolveCampDeathRespawn<T extends MutablePoint2>(
  target: T,
  checkpointActive: boolean,
  defaultX: number,
  defaultZ: number,
): T {
  target.x = checkpointActive ? CAMP_PROGRESS.respawn[0] : defaultX
  target.z = checkpointActive ? CAMP_PROGRESS.respawn[1] : defaultZ
  return target
}

export function addDeadCampEnemyId(
  ids: readonly string[],
  enemyId: string,
): readonly string[] {
  if (!isStandardCampEnemyId(enemyId)) return ids
  for (let index = 0; index < ids.length; index += 1) {
    if (ids[index] === enemyId) return ids
  }
  return [...ids, enemyId]
}

export function removeDeadCampEnemyId(
  ids: readonly string[],
  enemyId: string,
): readonly string[] {
  let foundIndex = -1
  for (let index = 0; index < ids.length; index += 1) {
    if (ids[index] === enemyId) {
      foundIndex = index
      break
    }
  }
  if (foundIndex < 0) return ids
  return ids.filter((_id, index) => index !== foundIndex)
}

export function isValidDeadCampEnemyIds(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false
  for (let index = 0; index < value.length; index += 1) {
    const id = value[index]
    if (typeof id !== 'string' || !isStandardCampEnemyId(id)) return false
    for (let prior = 0; prior < index; prior += 1) {
      if (value[prior] === id) return false
    }
  }
  return true
}
