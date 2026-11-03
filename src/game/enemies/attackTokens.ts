import { ENEMY_ATTACK_TOKENS, type EnemyType } from '../../data/enemies'

export type AttackTokenKind = 'melee' | 'ranged'
export type AttackTokenEvent =
  'request' | 'impact' | 'stagger' | 'death' | 'leftAttack'

export type AttackTokenState = {
  readonly meleeOwners: (string | null)[]
  readonly rangedOwners: (string | null)[]
}

export type WaitingTarget = {
  x: number
  z: number
}

export function createAttackTokenState(): AttackTokenState {
  return {
    meleeOwners: new Array<string | null>(ENEMY_ATTACK_TOKENS.meleeCap).fill(
      null,
    ),
    rangedOwners: new Array<string | null>(ENEMY_ATTACK_TOKENS.archerCap).fill(
      null,
    ),
  }
}

function ownerSlots(
  state: AttackTokenState,
  kind: AttackTokenKind,
): (string | null)[] {
  return kind === 'melee' ? state.meleeOwners : state.rangedOwners
}

export function tokenKindForEnemy(enemyType: EnemyType): AttackTokenKind {
  return enemyType === 'brigandArcher' ? 'ranged' : 'melee'
}

export function ownsAttackToken(
  state: AttackTokenState,
  enemyId: string,
  kind: AttackTokenKind,
): boolean {
  const owners = ownerSlots(state, kind)
  for (let index = 0; index < owners.length; index += 1)
    if (owners[index] === enemyId) return true
  return false
}

export function countAttackTokens(
  state: AttackTokenState,
  kind: AttackTokenKind,
): number {
  const owners = ownerSlots(state, kind)
  let count = 0
  for (let index = 0; index < owners.length; index += 1)
    if (owners[index] !== null) count += 1
  return count
}

export function acquireAttackToken(
  state: AttackTokenState,
  enemyId: string,
  kind: AttackTokenKind,
  paused: boolean,
): boolean {
  if (paused) return ownsAttackToken(state, enemyId, kind)
  const owners = ownerSlots(state, kind)
  for (let index = 0; index < owners.length; index += 1) {
    if (owners[index] === enemyId) return true
    if (owners[index] === null) {
      owners[index] = enemyId
      return true
    }
  }
  return false
}

export function releaseAttackToken(
  state: AttackTokenState,
  enemyId: string,
  paused: boolean,
): boolean {
  if (paused) return false
  return (
    releaseFromOwners(state.meleeOwners, enemyId) ||
    releaseFromOwners(state.rangedOwners, enemyId)
  )
}

function releaseFromOwners(
  owners: (string | null)[],
  enemyId: string,
): boolean {
  for (let index = 0; index < owners.length; index += 1) {
    if (owners[index] !== enemyId) continue
    owners[index] = null
    return true
  }
  return false
}

export function clearAttackTokens(state: AttackTokenState): void {
  state.meleeOwners.fill(null)
  state.rangedOwners.fill(null)
}

export function applyAttackTokenEvent(
  state: AttackTokenState,
  enemyId: string,
  kind: AttackTokenKind,
  event: AttackTokenEvent,
  paused: boolean,
): boolean {
  switch (event) {
    case 'request':
      return acquireAttackToken(state, enemyId, kind, paused)
    case 'impact':
    case 'stagger':
    case 'death':
    case 'leftAttack':
      return releaseAttackToken(state, enemyId, paused)
  }
}

export function resolveWaitingTarget(
  target: WaitingTarget,
  enemyId: string,
  enemyX: number,
  enemyZ: number,
  playerX: number,
  playerZ: number,
): WaitingTarget {
  let radialX = enemyX - playerX
  let radialZ = enemyZ - playerZ
  const radialLength = Math.hypot(radialX, radialZ)
  if (radialLength > Number.EPSILON) {
    radialX /= radialLength
    radialZ /= radialLength
  } else {
    radialX = 1
    radialZ = 0
  }

  const circleSign = enemyId.length % 2 === 0 ? 1 : -1
  const tangentX = -radialZ * circleSign
  const tangentZ = radialX * circleSign
  const combinedX = radialX + tangentX * 0.5
  const combinedZ = radialZ + tangentZ * 0.5
  const inverseCombinedLength = 1 / Math.hypot(combinedX, combinedZ)
  target.x =
    playerX +
    combinedX * inverseCombinedLength * ENEMY_ATTACK_TOKENS.waitingRadius
  target.z =
    playerZ +
    combinedZ * inverseCombinedLength * ENEMY_ATTACK_TOKENS.waitingRadius
  return target
}
