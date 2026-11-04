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
import {
  getQuestRuntimeSnapshot,
  markCampEnemyDead,
  markCampEnemyRespawned,
} from '../quest/questRuntime'
import { shouldBucklerBlock, type AiState } from './ai'
import {
  applyAttackTokenEvent,
  clearAttackTokens,
  createAttackTokenState,
  releaseAttackToken,
  tokenKindForEnemy,
} from './attackTokens'
import {
  advanceCampBreakoff,
  beginCampBreakoff,
  clearCampBreakoff,
  createCampBreakoffState,
  isCampBreakoffActive,
  isCampQuestActive,
  isStandardCampEnemyId,
  shouldBreakOffCampEnemy,
} from './campProgress'
import { createArrowPool, launchArrow } from './projectiles'
import {
  advanceRespawnElapsed,
  createCampLeaderSpawn,
  type CampLeaderSpawnState,
} from './spawns'

export type EnemyPhase = 'Alive' | 'Dying' | 'Dead'

export type EnemyScene = 'zone' | 'hollow'

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
  guardBroken: boolean
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
  hitFlashSequence: number
  blockFlashSequence: number
  inFrustum: boolean
  teleportRequested: boolean
  campRespawnHeld: boolean
  preserveHpOnReturn: boolean
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
  respawns?: boolean
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
let enemyHeightSampler: (x: number, z: number) => number = heightAt
const INITIAL_RANDOM_STATE = 0x51_4f_4e_45
const restoredCampEnemyDeaths: string[] = []
let restoredCampRespawnsHeld = false
const campBreakoff = createCampBreakoffState()

type EnemySceneState = {
  readonly records: EnemyRecord[]
  readonly arrows: ReturnType<typeof createArrowPool>
  readonly attackTokens: ReturnType<typeof createAttackTokenState>
  initialized: boolean
  debugSpawnSequence: number
  randomState: number
}

function createEnemySceneState(): EnemySceneState {
  return {
    records: [],
    arrows: createArrowPool(),
    attackTokens: createAttackTokenState(),
    initialized: false,
    debugSpawnSequence: 0,
    randomState: INITIAL_RANDOM_STATE,
  }
}

const enemyScenes: Record<EnemyScene, EnemySceneState> = {
  zone: createEnemySceneState(),
  hollow: createEnemySceneState(),
}
let activeEnemyScene: EnemyScene = 'zone'

function activeSceneState(): EnemySceneState {
  return enemyScenes[activeEnemyScene]
}

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
  return enemyHeightSampler(x, z) + bodyHeight * scale * 0.5
}

function nextRandom(): number {
  const state = activeSceneState()
  state.randomState =
    (Math.imul(state.randomState, 1_664_525) + 1_013_904_223) >>> 0
  return state.randomState / 4_294_967_296
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
    respawns: isCampLeader ? CAMP_LEADER.respawns : (spawn.respawns ?? true),
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
    hitFlashSequence: 0,
    blockFlashSequence: 0,
    inFrustum: false,
    teleportRequested: false,
    campRespawnHeld: false,
    preserveHpOnReturn: false,
  }
}

function hasRestoredCampDeath(enemyId: string): boolean {
  for (let index = 0; index < restoredCampEnemyDeaths.length; index += 1)
    if (restoredCampEnemyDeaths[index] === enemyId) return true
  return false
}

function applyRestoredCampDeaths(): void {
  for (const enemy of enemyRuntime.records) {
    if (!hasRestoredCampDeath(enemy.id)) continue
    releaseAttackToken(enemyRuntime.attackTokens, enemy.id, false)
    enemy.hp = 0
    enemy.phase = 'Dead'
    enemy.state = 'Return'
    enemy.deathElapsed = ENEMY_DEATH.fallSeconds
    enemy.respawnElapsed = 0
    enemy.attackCooldown = 0
    enemy.drawRemaining = 0
    enemy.campRespawnHeld = restoredCampRespawnsHeld
  }
}

export const enemyRuntime = {
  records: enemyScenes.zone.records,
  arrows: enemyScenes.zone.arrows,
  attackTokens: enemyScenes.zone.attackTokens,
  campLeaderDefeated: false,
}

export function getActiveEnemyScene(): EnemyScene {
  return activeEnemyScene
}

export function activateEnemyScene(scene: EnemyScene): boolean {
  if (scene === activeEnemyScene) return false
  activeEnemyScene = scene
  const state = activeSceneState()
  enemyRuntime.records = state.records
  enemyRuntime.arrows = state.arrows
  enemyRuntime.attackTokens = state.attackTokens
  notifyRoster()
  return true
}

export function isEnemySceneInitialized(
  scene: EnemyScene = activeEnemyScene,
): boolean {
  return enemyScenes[scene].initialized
}

export function resetEnemySceneRosters(): void {
  for (const scene of ['zone', 'hollow'] as const) {
    const state = enemyScenes[scene]
    state.records.length = 0
    state.arrows.active.fill(0)
    clearAttackTokens(state.attackTokens)
    state.initialized = false
    state.debugSpawnSequence = 0
    state.randomState = INITIAL_RANDOM_STATE
  }
  activeEnemyScene = 'zone'
  enemyRuntime.records = enemyScenes.zone.records
  enemyRuntime.arrows = enemyScenes.zone.arrows
  enemyRuntime.attackTokens = enemyScenes.zone.attackTokens
  enemyRuntime.campLeaderDefeated = false
  restoredCampEnemyDeaths.length = 0
  restoredCampRespawnsHeld = false
  clearCampBreakoff(campBreakoff)
  notifyRoster()
}

export function setEnemyHeightSampler(
  sampleHeight: (x: number, z: number) => number,
): void {
  enemyHeightSampler = sampleHeight
}

export function sampleEnemyGroundHeight(x: number, z: number): number {
  return enemyHeightSampler(x, z)
}

export function initializeEnemyRoster(spawns: readonly EnemySpawnLike[]): void {
  const state = activeSceneState()
  state.records.length = 0
  for (const spawn of spawns) state.records.push(makeRecord(spawn))
  state.initialized = true
  state.debugSpawnSequence = 0
  state.randomState = INITIAL_RANDOM_STATE
  state.arrows.active.fill(0)
  clearAttackTokens(state.attackTokens)
  applyRestoredCampDeaths()
  if (activeEnemyScene === 'zone') enemyRuntime.campLeaderDefeated = false
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

export function beginCampEnemyBreakoff(): void {
  beginCampBreakoff(campBreakoff)
  clearAttackTokens(enemyRuntime.attackTokens)
  for (const enemy of enemyRuntime.records) {
    if (!isStandardCampEnemyId(enemy.id) || enemy.phase !== 'Alive') continue
    enemy.state = 'Return'
    enemy.stateElapsed = 0
    enemy.attackCooldown = 0
    enemy.drawRemaining = 0
    enemy.preserveHpOnReturn = true
  }
}

export function ensureCampEnemyBreakoff(): void {
  if (!isCampBreakoffActive(campBreakoff)) beginCampEnemyBreakoff()
}

export function advanceCampEnemyBreakoff(deltaSeconds: number): void {
  advanceCampBreakoff(campBreakoff, deltaSeconds)
}

export function endCampEnemyBreakoff(): void {
  clearCampBreakoff(campBreakoff)
}

export function isCampEnemyBreakoffActiveFor(enemyId: string): boolean {
  return shouldBreakOffCampEnemy(campBreakoff, enemyId)
}

export function getCampEnemyBreakoffRemainingSeconds(): number {
  return campBreakoff.remainingSeconds
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
  const scene = activeSceneState()
  scene.debugSpawnSequence += 1
  const id = `debug-${type}-${scene.debugSpawnSequence}`
  enemyRuntime.records.push(makeRecord({ id, type, x, z }))
  notifyRoster()
  return id
}

export function spawnCampLeaderForDebug(): string {
  const scene = activeSceneState()
  scene.debugSpawnSequence += 1
  const spawn = createCampLeaderSpawn({
    questStep: CAMP_LEADER.minimumQuestStep,
    keyLooted: false,
    leaderDefeated: false,
  })
  if (!spawn) return ''
  const id = `debug-camp-leader-${scene.debugSpawnSequence}`
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
    return { damage: 0, blocked: false, guardBroken: false, killed: false }

  let guardBroken = false
  if (meta.kind === 'cast') {
    const roll = meta.randomValue ?? nextRandom()
    const angle = meta.angleFromFacingDegrees ?? 180
    const wouldBlock = shouldBucklerBlock(
      enemy.type,
      'straightCast',
      angle,
      false,
      roll,
    )
    guardBroken = wouldBlock && meta.breaksGuard === true
    if (wouldBlock && !guardBroken) {
      enemy.blockFlashSequence += 1
      return { damage: 0, blocked: true, guardBroken: false, killed: false }
    }
  }

  const damage = Math.max(0, amount)
  enemy.hp = Math.max(0, enemy.hp - damage)
  enemy.lastDamage = damage
  if (guardBroken) enemy.blockFlashSequence += 1
  if (damage > 0) enemy.hitFlashSequence += 1
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
  if (castStaggersLight || comboThreeStaggersBrigand)
    applyAttackTokenEvent(
      enemyRuntime.attackTokens,
      enemy.id,
      tokenKindForEnemy(enemy.type),
      'stagger',
      false,
    )
  if (enemy.hp === 0) {
    applyAttackTokenEvent(
      enemyRuntime.attackTokens,
      enemy.id,
      tokenKindForEnemy(enemy.type),
      'death',
      false,
    )
    enemy.phase = 'Dying'
    enemy.deathElapsed = 0
    enemy.respawnElapsed = 0
    enemy.state = 'Return'
    enemy.campRespawnHeld = markCampEnemyDead(enemy.id)
    if (
      enemy.campRespawnHeld &&
      !hasRestoredCampDeath(enemy.id) &&
      isStandardCampEnemyId(enemy.id)
    )
      restoredCampEnemyDeaths.push(enemy.id)
    if (enemy.variant === ENEMY_VARIANTS.campLeader) {
      enemyRuntime.campLeaderDefeated = true
      beginCampEnemyBreakoff()
      campLeaderDefeatedHandler?.(enemy.id, enemy.x, enemy.y, enemy.z)
    }
  }
  return {
    damage,
    blocked: false,
    guardBroken,
    killed: enemy.hp === 0,
  }
}

export function canEnemyRespawn(enemy: EnemyRecord): boolean {
  return enemy.respawns && !enemy.campRespawnHeld
}

export function restoreCampEnemyDeaths(
  enemyIds: readonly string[],
  respawnsHeld: boolean,
): void {
  restoredCampEnemyDeaths.length = 0
  for (let index = 0; index < enemyIds.length; index += 1) {
    const enemyId = enemyIds[index]
    if (isStandardCampEnemyId(enemyId)) restoredCampEnemyDeaths.push(enemyId)
  }
  restoredCampRespawnsHeld = respawnsHeld
  applyRestoredCampDeaths()
}

export function releaseCampEnemyRespawns(): void {
  endCampEnemyBreakoff()
  restoredCampRespawnsHeld = false
  for (const enemy of enemyRuntime.records) {
    if (!enemy.campRespawnHeld) continue
    enemy.campRespawnHeld = false
    enemy.respawnElapsed = 0
  }
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
  const quest = getQuestRuntimeSnapshot().quest
  const preserveCampLeaderHp = isCampQuestActive(
    quest.currentStep,
    quest.keyLooted,
  )
  for (const enemy of enemyRuntime.records) {
    const isCampLeader = enemy.variant === ENEMY_VARIANTS.campLeader
    if (
      enemy.phase === 'Alive' &&
      (isWithinPlayerDeathResetRadius(enemy.x, enemy.z, deathX, deathZ) ||
        (preserveCampLeaderHp && isCampLeader))
    ) {
      enemy.state = 'Return'
      enemy.stateElapsed = 0
      enemy.drawRemaining = 0
      enemy.preserveHpOnReturn = preserveCampLeaderHp && isCampLeader
      releaseAttackToken(enemyRuntime.attackTokens, enemy.id, false)
    }
  }
}

export function completeEnemyReturn(enemy: EnemyRecord): void {
  if (enemy.preserveHpOnReturn) {
    if (enemy.state !== 'Return') enemy.preserveHpOnReturn = false
    return
  }
  enemy.hp = enemy.maxHp
}

export function resetEnemyAtAnchor(enemy: EnemyRecord): void {
  releaseAttackToken(enemyRuntime.attackTokens, enemy.id, false)
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
  enemy.hitFlashSequence = 0
  enemy.blockFlashSequence = 0
  enemy.inFrustum = false
  enemy.teleportRequested = false
  enemy.campRespawnHeld = false
  enemy.preserveHpOnReturn = false
  if (isStandardCampEnemyId(enemy.id)) {
    markCampEnemyRespawned(enemy.id)
    for (let index = 0; index < restoredCampEnemyDeaths.length; index += 1) {
      if (restoredCampEnemyDeaths[index] !== enemy.id) continue
      restoredCampEnemyDeaths.splice(index, 1)
      break
    }
  }
}
