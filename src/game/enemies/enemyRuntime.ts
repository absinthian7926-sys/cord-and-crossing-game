import {
  CAMP_LEADER,
  ENEMY_AI,
  ENEMY_DEATH,
  ENEMY_TYPES,
  ENEMY_VARIANTS,
  type EnemyType,
  type EnemyVariant,
} from '../../data/enemies'
import { heightAt } from '../world/terrain'
import { shouldBucklerBlock, type AiState } from './ai'
import { createArrowPool, launchArrow } from './projectiles'
import {
  advanceRespawnElapsed,
  createCampLeaderSpawn,
  type CampLeaderSpawnState,
} from './spawns'

export type EnemyPhase = 'Alive' | 'Dying' | 'Dead'

export type EnemyHitKind = 'close' | 'cast' | 'arc' | 'shove'

export type EnemyHitMeta = {
  kind: EnemyHitKind
  angleFromFacingDegrees?: number
  randomValue?: number
  breaksGuard?: boolean
  comboIndex?: number
  staggerSeconds?: number
}

export type EnemyDamageResult = {
  damage: number
  blocked: boolean
  killed: boolean
}

export type EnemyRecord = {
  id: string
  type: EnemyType
  variant: EnemyVariant
  scale: number
  respawns: boolean
  state: AiState
  hp: number
  maxHp: number
  x: number
  y: number
  z: number
  anchorX: number
  anchorZ: number
  facingX: number
  facingZ: number
  patrolStartX: number
  patrolStartZ: number
  patrolEndX: number
  patrolEndZ: number
  phase: EnemyPhase
  deathElapsed: number
  respawnElapsed: number
  attackCooldown: number
  drawRemaining: number
  healthBarRemaining: number
  staggerRemaining: number
  patrolIndex: number
  stateElapsed: number
  lastDamage: number
  inFrustum: boolean
  teleportRequested: boolean
}

export type EnemySnapshot = {
  id: string
  type: EnemyType
  variant: EnemyVariant
  state: AiState
  hp: number
  position: { x: number; y: number; z: number }
  alive: boolean
  attackCooldown: number
  inFrustum: boolean
}

export type EnemySpawnLike = {
  id: string
  type: EnemyType
  variant?: EnemyVariant
  x: number
  z: number
  anchorX?: number
  anchorZ?: number
  patrolStartX?: number
  patrolStartZ?: number
  patrolEndX?: number
  patrolEndZ?: number
}

type RosterListener = () => void
type HoundBiteHandler = (x: number, y: number, z: number) => boolean
type CampLeaderDefeatedHandler = (
  id: string,
  x: number,
  y: number,
  z: number,
) => void

const rosterListeners = new Set<RosterListener>()
let houndBiteHandler: HoundBiteHandler | null = null
let campLeaderDefeatedHandler: CampLeaderDefeatedHandler | null = null
let debugSpawnSequence = 0
let randomState = 0x51_4f_4e_45

function notifyRoster(): void {
  for (const listener of rosterListeners) listener()
}

function groundedY(
  type: EnemyType,
  scale: number,
  x: number,
  z: number,
): number {
  const bodyHeight =
    type === 'cliffHound'
      ? ENEMY_TYPES.cliffHound.collider.length
      : ENEMY_TYPES[type].collider.height
  return heightAt(x, z) + bodyHeight * scale * 0.5
}

function nextRandom(): number {
  randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0
  return randomState / 4_294_967_296
}

function makeRecord(spawn: EnemySpawnLike): EnemyRecord {
  const stats = ENEMY_TYPES[spawn.type]
  const variant = spawn.variant ?? ENEMY_VARIANTS.standard
  const isCampLeader = variant === ENEMY_VARIANTS.campLeader
  const scale = isCampLeader ? CAMP_LEADER.scale : 1
  const maxHealth = isCampLeader ? CAMP_LEADER.maxHealth : stats.maxHealth
  return {
    id: spawn.id,
    type: spawn.type,
    variant,
    scale,
    respawns: isCampLeader ? CAMP_LEADER.respawns : true,
    state: 'Idle',
    hp: maxHealth,
    maxHp: maxHealth,
    x: spawn.x,
    y: groundedY(spawn.type, scale, spawn.x, spawn.z),
    z: spawn.z,
    anchorX: spawn.anchorX ?? spawn.x,
    anchorZ: spawn.anchorZ ?? spawn.z,
    facingX: 0,
    facingZ: -1,
    patrolStartX: spawn.patrolStartX ?? spawn.x,
    patrolStartZ: spawn.patrolStartZ ?? spawn.z,
    patrolEndX: spawn.patrolEndX ?? spawn.x,
    patrolEndZ: spawn.patrolEndZ ?? spawn.z,
    phase: 'Alive',
    deathElapsed: 0,
    respawnElapsed: 0,
    attackCooldown: 0,
    drawRemaining: 0,
    healthBarRemaining: 0,
    staggerRemaining: 0,
    patrolIndex: 0,
    stateElapsed: 0,
    lastDamage: 0,
    inFrustum: false,
    teleportRequested: false,
  }
}

export const enemyRuntime = {
  records: [] as EnemyRecord[],
  arrows: createArrowPool(),
  campLeaderDefeated: false,
}

export function initializeEnemyRoster(spawns: readonly EnemySpawnLike[]): void {
  enemyRuntime.records.length = 0
  for (const spawn of spawns) enemyRuntime.records.push(makeRecord(spawn))
  debugSpawnSequence = 0
  randomState = 0x51_4f_4e_45
  enemyRuntime.arrows.active.fill(0)
  enemyRuntime.campLeaderDefeated = false
  notifyRoster()
}

export function fireEnemyArrow(
  startX: number,
  startY: number,
  startZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
): number {
  return launchArrow(
    enemyRuntime.arrows,
    startX,
    startY,
    startZ,
    targetX,
    targetY,
    targetZ,
  )
}

export function subscribeEnemyRoster(listener: RosterListener): () => void {
  rosterListeners.add(listener)
  return () => rosterListeners.delete(listener)
}

export function registerHoundBiteHandler(
  handler: HoundBiteHandler | null,
): void {
  houndBiteHandler = handler
}

export function registerCampLeaderDefeatedHandler(
  handler: CampLeaderDefeatedHandler | null,
): void {
  campLeaderDefeatedHandler = handler
}

export function setCampLeaderDefeated(defeated: boolean): void {
  enemyRuntime.campLeaderDefeated = defeated
}

export function requestHoundCordBite(x: number, y: number, z: number): boolean {
  return houndBiteHandler?.(x, y, z) ?? false
}

export function getEnemyRecord(id: string): EnemyRecord | undefined {
  for (const enemy of enemyRuntime.records) if (enemy.id === id) return enemy
  return undefined
}

export function getEnemySnapshots(): EnemySnapshot[] {
  return enemyRuntime.records.map((enemy) => ({
    id: enemy.id,
    type: enemy.type,
    variant: enemy.variant,
    state: enemy.state,
    hp: enemy.hp,
    position: { x: enemy.x, y: enemy.y, z: enemy.z },
    alive: enemy.phase === 'Alive',
    attackCooldown: enemy.attackCooldown,
    inFrustum: enemy.inFrustum,
  }))
}

export function ensureCampLeaderSpawned(
  state: CampLeaderSpawnState,
): string | null {
  if (enemyRuntime.campLeaderDefeated) return null
  const spawn = createCampLeaderSpawn(state)
  if (!spawn) return null
  for (const enemy of enemyRuntime.records)
    if (enemy.variant === ENEMY_VARIANTS.campLeader) return enemy.id
  enemyRuntime.records.push(
    makeRecord({
      id: spawn.id,
      type: spawn.enemyType,
      variant: spawn.variant,
      x: spawn.x,
      z: spawn.z,
      anchorX: spawn.anchorX,
      anchorZ: spawn.anchorZ,
      patrolStartX: spawn.patrolStartX,
      patrolStartZ: spawn.patrolStartZ,
      patrolEndX: spawn.patrolEndX,
      patrolEndZ: spawn.patrolEndZ,
    }),
  )
  notifyRoster()
  return spawn.id
}

export function spawnEnemy(type: EnemyType, x: number, z: number): string {
  debugSpawnSequence += 1
  const id = `debug-${type}-${debugSpawnSequence}`
  enemyRuntime.records.push(makeRecord({ id, type, x, z }))
  notifyRoster()
  return id
}

export function spawnCampLeaderForDebug(): string {
  debugSpawnSequence += 1
  const spawn = createCampLeaderSpawn({
    questStep: CAMP_LEADER.minimumQuestStep,
    keyLooted: false,
    leaderDefeated: false,
  })
  if (!spawn) return ''
  const id = `debug-camp-leader-${debugSpawnSequence}`
  enemyRuntime.records.push(
    makeRecord({
      id,
      type: spawn.enemyType,
      variant: spawn.variant,
      x: spawn.x,
      z: spawn.z,
      anchorX: spawn.anchorX,
      anchorZ: spawn.anchorZ,
    }),
  )
  notifyRoster()
  return id
}

export function damageEnemy(
  id: string,
  amount: number,
  meta: EnemyHitMeta,
): EnemyDamageResult {
  const enemy = getEnemyRecord(id)
  if (!enemy || enemy.phase !== 'Alive')
    return { damage: 0, blocked: false, killed: false }

  if (meta.kind === 'cast') {
    const roll = meta.randomValue ?? nextRandom()
    const angle = meta.angleFromFacingDegrees ?? 180
    if (
      shouldBucklerBlock(
        enemy.type,
        'straightCast',
        angle,
        meta.breaksGuard === true,
        roll,
      )
    )
      return { damage: 0, blocked: true, killed: false }
  }

  const damage = Math.max(0, amount)
  enemy.hp = Math.max(0, enemy.hp - damage)
  enemy.lastDamage = damage
  enemy.healthBarRemaining = ENEMY_DEATH.healthBarSeconds
  const castStaggersLight =
    meta.kind === 'cast' && ENEMY_TYPES[enemy.type].light
  const comboThreeStaggersBrigand =
    enemy.type === 'roadBrigand' &&
    meta.kind === 'close' &&
    meta.comboIndex === 2
  if (castStaggersLight || comboThreeStaggersBrigand)
    enemy.staggerRemaining = Math.max(
      enemy.staggerRemaining,
      meta.staggerSeconds ?? 0,
    )
  if (enemy.hp === 0) {
    enemy.phase = 'Dying'
    enemy.deathElapsed = 0
    enemy.respawnElapsed = 0
    enemy.state = 'Return'
    if (enemy.variant === ENEMY_VARIANTS.campLeader) {
      enemyRuntime.campLeaderDefeated = true
      campLeaderDefeatedHandler?.(enemy.id, enemy.x, enemy.y, enemy.z)
    }
  }
  return { damage, blocked: false, killed: enemy.hp === 0 }
}

export function canEnemyRespawn(enemy: EnemyRecord): boolean {
  return enemy.respawns
}

export function angleFromEnemyFacing(
  enemy: EnemyRecord,
  targetX: number,
  targetZ: number,
): number {
  const toTargetX = targetX - enemy.x
  const toTargetZ = targetZ - enemy.z
  const targetLength = Math.hypot(toTargetX, toTargetZ)
  const facingLength = Math.hypot(enemy.facingX, enemy.facingZ)
  if (targetLength === 0 || facingLength === 0) return 180
  const dot =
    (enemy.facingX * toTargetX + enemy.facingZ * toTargetZ) /
    (facingLength * targetLength)
  return (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI
}

export function killEnemy(id: string): boolean {
  const enemy = getEnemyRecord(id)
  if (!enemy || enemy.phase !== 'Alive') return false
  damageEnemy(id, enemy.hp, { kind: 'shove' })
  return true
}

export function advanceRespawn(seconds: number): void {
  const elapsed = Math.max(0, seconds)
  for (const enemy of enemyRuntime.records) {
    if (enemy.phase === 'Dying') enemy.deathElapsed += elapsed
    if (enemy.phase !== 'Alive')
      enemy.respawnElapsed = advanceRespawnElapsed(
        enemy.respawnElapsed,
        elapsed,
      )
  }
}

export function isWithinPlayerDeathResetRadius(
  enemyX: number,
  enemyZ: number,
  deathX: number,
  deathZ: number,
): boolean {
  const offsetX = enemyX - deathX
  const offsetZ = enemyZ - deathZ
  return (
    offsetX * offsetX + offsetZ * offsetZ <=
    ENEMY_AI.playerDeathResetRadius * ENEMY_AI.playerDeathResetRadius
  )
}

export function resetEnemiesNearDeathToReturn(
  deathX: number,
  deathZ: number,
): void {
  for (const enemy of enemyRuntime.records) {
    if (
      enemy.phase === 'Alive' &&
      isWithinPlayerDeathResetRadius(enemy.x, enemy.z, deathX, deathZ)
    ) {
      enemy.state = 'Return'
      enemy.stateElapsed = 0
      enemy.drawRemaining = 0
    }
  }
}

export function resetEnemyAtAnchor(enemy: EnemyRecord): void {
  enemy.state = 'Idle'
  enemy.hp = enemy.maxHp
  enemy.x = enemy.anchorX
  enemy.z = enemy.anchorZ
  enemy.y = groundedY(enemy.type, enemy.scale, enemy.x, enemy.z)
  enemy.facingX = 0
  enemy.facingZ = -1
  enemy.phase = 'Alive'
  enemy.deathElapsed = 0
  enemy.respawnElapsed = 0
  enemy.attackCooldown = 0
  enemy.drawRemaining = 0
  enemy.healthBarRemaining = 0
  enemy.staggerRemaining = 0
  enemy.patrolIndex = 0
  enemy.stateElapsed = 0
  enemy.lastDamage = 0
  enemy.inFrustum = false
  enemy.teleportRequested = false
}
