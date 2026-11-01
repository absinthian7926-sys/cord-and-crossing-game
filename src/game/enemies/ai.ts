import { ENEMY_AI, ENEMY_TYPES, type EnemyType } from '../../data/enemies'
import { REACHBLADE } from '../../data/weapons'
import { capsuleOverlapsPoint } from '../combat/hitboxes'
import { canCordBeCut, type CordState } from '../weapons/cordState'

export const AI_STATES = [
  'Idle',
  'Patrol',
  'Alert',
  'Chase',
  'Attack',
  'Flee',
  'Return',
] as const

export type AiState = (typeof AI_STATES)[number]

export type AiMoveTarget =
  | 'None'
  | 'PatrolPoint'
  | 'Player'
  | 'FlankPlayer'
  | 'AwayFromPlayer'
  | 'Anchor'

export type AiInputs = {
  enemyType: EnemyType
  distanceToPlayer: number
  distanceFromAnchor: number
  distanceToAnchor: number
  healthFraction: number
  lineOfSight: boolean
  playerAlive: boolean
  playerInSafeZone: boolean
  stateElapsedSeconds: number
  attackCooldownSeconds: number
  attackWindupSeconds: number
}

export type AiStepResult = {
  state: AiState
  moveTarget: AiMoveTarget
  attack: boolean
  retreat: boolean
  healAtAnchor: boolean
  stateElapsedSeconds: number
  attackCooldownSeconds: number
  attackWindupSeconds: number
}

export function createAiStepResult(): AiStepResult {
  return {
    state: 'Idle',
    moveTarget: 'None',
    attack: false,
    retreat: false,
    healAtAnchor: false,
    stateElapsedSeconds: 0,
    attackCooldownSeconds: 0,
    attackWindupSeconds: 0,
  }
}

function enterState(
  result: AiStepResult,
  current: AiState,
  next: AiState,
  elapsedSeconds: number,
): void {
  result.state = next
  result.stateElapsedSeconds = next === current ? elapsedSeconds : 0
  if (next !== 'Attack') result.attackWindupSeconds = 0
}

function setMovementIntent(result: AiStepResult, enemyType: EnemyType): void {
  switch (result.state) {
    case 'Idle':
    case 'Alert':
    case 'Attack':
      result.moveTarget = 'None'
      break
    case 'Patrol':
      result.moveTarget = 'PatrolPoint'
      break
    case 'Chase':
      result.moveTarget = enemyType === 'cliffHound' ? 'FlankPlayer' : 'Player'
      break
    case 'Flee':
      result.moveTarget = 'AwayFromPlayer'
      result.retreat = true
      break
    case 'Return':
      result.moveTarget = 'Anchor'
      break
  }
}

export function stepAi(
  state: AiState,
  inputs: AiInputs,
  dtSeconds: number,
  result: AiStepResult,
): AiStepResult {
  const deltaSeconds = Math.max(0, dtSeconds)
  const elapsedSeconds = Math.max(0, inputs.stateElapsedSeconds) + deltaSeconds
  const enemy = ENEMY_TYPES[inputs.enemyType]
  const attackDistance =
    inputs.enemyType === 'brigandArcher'
      ? ENEMY_TYPES.brigandArcher.keepAway.maximumDistance
      : enemy.attackRange
  const canSeePlayer =
    inputs.lineOfSight && inputs.distanceToPlayer <= ENEMY_AI.aggroRadius

  result.state = state
  result.moveTarget = 'None'
  result.attack = false
  result.retreat = false
  result.healAtAnchor = false
  result.stateElapsedSeconds = elapsedSeconds
  const attackCooldownSeconds = Math.max(
    0,
    inputs.attackCooldownSeconds - deltaSeconds,
  )
  result.attackCooldownSeconds =
    attackCooldownSeconds <= Number.EPSILON ? 0 : attackCooldownSeconds
  result.attackWindupSeconds = Math.max(0, inputs.attackWindupSeconds)

  if (
    !inputs.playerAlive ||
    inputs.playerInSafeZone ||
    inputs.distanceFromAnchor > ENEMY_AI.leashRadius
  ) {
    enterState(result, state, 'Return', elapsedSeconds)
    setMovementIntent(result, inputs.enemyType)
    return result
  }

  if (
    inputs.enemyType === 'brigandArcher' &&
    inputs.healthFraction <= ENEMY_TYPES.brigandArcher.fleeHealthFraction
  ) {
    enterState(result, state, 'Flee', elapsedSeconds)
    setMovementIntent(result, inputs.enemyType)
    return result
  }

  switch (state) {
    case 'Idle':
      enterState(
        result,
        state,
        canSeePlayer ? 'Alert' : 'Patrol',
        elapsedSeconds,
      )
      break
    case 'Patrol':
      enterState(
        result,
        state,
        canSeePlayer ? 'Alert' : 'Patrol',
        elapsedSeconds,
      )
      break
    case 'Alert':
      if (!canSeePlayer) {
        enterState(result, state, 'Patrol', elapsedSeconds)
      } else if (elapsedSeconds >= ENEMY_AI.alertSeconds) {
        enterState(result, state, 'Chase', elapsedSeconds)
      }
      break
    case 'Chase':
      if (
        inputs.enemyType === 'brigandArcher' &&
        inputs.distanceToPlayer <
          ENEMY_TYPES.brigandArcher.keepAway.minimumDistance
      ) {
        result.retreat = true
        result.moveTarget = 'AwayFromPlayer'
      } else if (
        inputs.lineOfSight &&
        inputs.distanceToPlayer <= attackDistance
      ) {
        enterState(result, state, 'Attack', elapsedSeconds)
      }
      break
    case 'Attack':
      if (
        inputs.enemyType === 'brigandArcher' &&
        inputs.distanceToPlayer <
          ENEMY_TYPES.brigandArcher.keepAway.minimumDistance
      ) {
        enterState(result, state, 'Chase', elapsedSeconds)
        result.retreat = true
        result.moveTarget = 'AwayFromPlayer'
      } else if (
        !inputs.lineOfSight ||
        inputs.distanceToPlayer > attackDistance
      ) {
        enterState(result, state, 'Chase', elapsedSeconds)
      } else if (inputs.enemyType === 'brigandArcher') {
        if (inputs.attackCooldownSeconds > 0) {
          result.attackWindupSeconds = Math.max(
            0,
            ENEMY_TYPES.brigandArcher.drawSeconds -
              result.attackCooldownSeconds,
          )
          if (result.attackCooldownSeconds === 0) {
            result.attack = true
            result.attackCooldownSeconds = enemy.attackCadenceSeconds
            result.attackWindupSeconds = 0
          }
        } else {
          result.attackWindupSeconds += deltaSeconds
          if (
            result.attackWindupSeconds >= ENEMY_TYPES.brigandArcher.drawSeconds
          ) {
            result.attack = true
            result.attackCooldownSeconds = enemy.attackCadenceSeconds
            result.attackWindupSeconds = 0
          }
        }
      } else if (result.attackCooldownSeconds === 0) {
        result.attack = true
        result.attackCooldownSeconds = enemy.attackCadenceSeconds
      } else {
        result.attackWindupSeconds = 0
      }
      break
    case 'Flee':
      enterState(result, state, 'Chase', elapsedSeconds)
      break
    case 'Return':
      if (inputs.distanceToAnchor <= ENEMY_AI.returnAnchorDistance) {
        enterState(result, state, 'Idle', elapsedSeconds)
        result.healAtAnchor = true
      }
      break
  }

  if (result.moveTarget === 'None') setMovementIntent(result, inputs.enemyType)
  return result
}

export type EnemyHitKind = 'straightCast' | 'flatArc' | 'close' | 'shove'

export function shouldBucklerBlock(
  enemyType: EnemyType,
  hitKind: EnemyHitKind,
  angleFromFacingDegrees: number,
  breaksGuard: boolean,
  randomValue: number,
): boolean {
  if (
    enemyType !== 'roadBrigand' ||
    hitKind !== 'straightCast' ||
    breaksGuard ||
    Math.abs(angleFromFacingDegrees) >
      ENEMY_TYPES.roadBrigand.buckler.frontalConeDegrees / 2
  ) {
    return false
  }
  return (
    randomValue >= 0 &&
    randomValue < ENEMY_TYPES.roadBrigand.buckler.blockChance
  )
}

export function houndBiteCutsCordSegment(
  cordState: CordState,
  houndX: number,
  houndY: number,
  houndZ: number,
  segmentStartX: number,
  segmentStartY: number,
  segmentStartZ: number,
  segmentEndX: number,
  segmentEndY: number,
  segmentEndZ: number,
): boolean {
  if (!canCordBeCut(cordState) || cordState.mode !== 'Out') return false
  return capsuleOverlapsPoint(
    houndX,
    houndY,
    houndZ,
    segmentStartX,
    segmentStartY,
    segmentStartZ,
    segmentEndX,
    segmentEndY,
    segmentEndZ,
    ENEMY_TYPES.cliffHound.cutterVolumeRadius + REACHBLADE.rope.collisionRadius,
  )
}
