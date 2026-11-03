import { afterEach, describe, expect, it } from 'vitest'
import { ENEMY_TYPES, ENEMY_ATTACK_TOKENS } from '../data/enemies'
import { PLAYER } from '../data/player'
import { REACHBLADE } from '../data/weapons'
import {
  acquireAttackToken,
  countAttackTokens,
  releaseAttackToken,
  tokenKindForEnemy,
} from '../game/enemies/attackTokens'
import { createAiStepResult, stepAi } from '../game/enemies/ai'
import {
  damageEnemy,
  enemyRuntime,
  initializeEnemyRoster,
  resetEnemySceneRosters,
} from '../game/enemies/enemyRuntime'
import { createSpawnPlan } from '../game/enemies/spawns'
import {
  applyCombatDamage,
  initialComboState,
  tryStartCloseAttack,
} from '../game/combat/combat'
import {
  initialVitals,
  spendDodgeStamina,
  spendStamina,
  updateVitals,
} from '../game/player/vitals'

describe('camp balance', () => {
  afterEach(() => resetEnemySceneRosters())

  it('lets fixed seed 7 inputs clear one camp group and retreat alive', () => {
    const westGroup = createSpawnPlan().filter(
      (spawn) => spawn.campGroup === 'tent-west',
    )
    initializeEnemyRoster(
      westGroup.map((spawn) => ({
        id: spawn.id,
        type: spawn.enemyType,
        x: spawn.x,
        z: spawn.z,
        anchorX: spawn.anchorX,
        anchorZ: spawn.anchorZ,
      })),
    )

    const fixedStep = 1 / 60
    const player = initialVitals()
    const groupCenterX = 380 - 24
    const groupCenterZ = -240
    const playerX = groupCenterX
    let playerZ = groupCenterZ + 15
    let elapsed = 0
    let combatStartedAt = Number.POSITIVE_INFINITY
    let retreatStartedAt = Number.POSITIVE_INFINITY
    let healthAtRetreat: number = PLAYER.health.max
    let dodgeUntil = 0
    let nextDodgeAt = Number.POSITIVE_INFINITY
    let randomState = 7
    const seededRandom = () => {
      randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0
      return randomState / 4_294_967_296
    }
    const aiResults = enemyRuntime.records.map(() => createAiStepResult())
    let combo = initialComboState()
    let pendingHitAt = Number.POSITIVE_INFINITY
    let pendingTargetId = ''
    let pendingDamage = 0
    let castHits = 0
    let nextCastAt = Number.POSITIVE_INFINITY
    let nextCloseAt = Number.POSITIVE_INFINITY
    let maximumMeleeTokens = 0
    let maximumArcherTokens = 0
    let playerDied = false

    while (elapsed < 20) {
      const alive = enemyRuntime.records.filter((enemy) => enemy.hp > 0)
      const fighting = alive.length > 0
      const approaching = fighting && playerZ > groupCenterZ + 2
      const retreating = !fighting && elapsed - retreatStartedAt < 2

      if (approaching) {
        playerZ = Math.max(
          groupCenterZ + 2,
          playerZ - PLAYER.movement.runSpeed * fixedStep,
        )
      } else if (fighting && combatStartedAt === Number.POSITIVE_INFINITY) {
        combatStartedAt = elapsed
        nextCastAt = elapsed
        nextDodgeAt = elapsed + seededRandom() * 0.1
      } else if (retreating) {
        playerZ += PLAYER.movement.runSpeed * fixedStep
      }

      if (fighting && elapsed >= nextDodgeAt) {
        if (spendDodgeStamina(player)) {
          dodgeUntil = elapsed + PLAYER.movement.dodgeInvulnerabilitySeconds
        }
        nextDodgeAt += PLAYER.movement.dodgeCooldownSeconds
      }

      for (let index = 0; index < enemyRuntime.records.length; index += 1) {
        const enemy = enemyRuntime.records[index]
        const kind = tokenKindForEnemy(enemy.type)
        if (enemy.hp <= 0) {
          releaseAttackToken(enemyRuntime.attackTokens, enemy.id, false)
          continue
        }
        const realDistance = Math.hypot(enemy.x - playerX, enemy.z - playerZ)
        const distanceToPlayer =
          enemy.type === 'brigandArcher' && !approaching
            ? 15
            : enemy.state === 'Chase' || enemy.state === 'Attack'
              ? Math.min(realDistance, ENEMY_TYPES[enemy.type].attackRange)
              : realDistance
        const windup =
          enemy.type === 'brigandArcher'
            ? ENEMY_TYPES.brigandArcher.drawSeconds
            : ENEMY_TYPES[enemy.type].attackWindupSeconds
        let tokenGranted = false
        if (
          enemy.state === 'Attack' &&
          enemy.attackCooldown <= windup + fixedStep
        ) {
          tokenGranted = acquireAttackToken(
            enemyRuntime.attackTokens,
            enemy.id,
            kind,
            false,
          )
        }
        const result = stepAi(
          enemy.state,
          {
            enemyType: enemy.type,
            distanceToPlayer,
            distanceFromAnchor: 0,
            distanceToAnchor: 0,
            healthFraction: enemy.hp / enemy.maxHp,
            lineOfSight: true,
            playerAlive: player.health > 0,
            playerInSafeZone: false,
            stateElapsedSeconds: enemy.stateElapsed,
            attackCooldownSeconds: enemy.attackCooldown,
            attackWindupSeconds: enemy.drawRemaining,
            attackTokenGranted: tokenGranted,
          },
          fixedStep,
          aiResults[index],
        )
        enemy.state = result.state
        enemy.stateElapsed = result.stateElapsedSeconds
        enemy.attackCooldown = result.attackCooldownSeconds
        enemy.drawRemaining = result.attackWindupSeconds
        if (result.attack) {
          releaseAttackToken(enemyRuntime.attackTokens, enemy.id, false)
          applyCombatDamage(
            player,
            ENEMY_TYPES[enemy.type].damage,
            false,
            elapsed < dodgeUntil,
          )
          if (player.health <= 0) playerDied = true
        } else if (result.state !== 'Attack') {
          releaseAttackToken(enemyRuntime.attackTokens, enemy.id, false)
        }
      }

      maximumMeleeTokens = Math.max(
        maximumMeleeTokens,
        countAttackTokens(enemyRuntime.attackTokens, 'melee'),
      )
      maximumArcherTokens = Math.max(
        maximumArcherTokens,
        countAttackTokens(enemyRuntime.attackTokens, 'ranged'),
      )

      if (elapsed >= pendingHitAt) {
        if (pendingTargetId)
          damageEnemy(pendingTargetId, pendingDamage, {
            kind: pendingTargetId.includes('brigandArcher') ? 'cast' : 'close',
            randomValue: seededRandom(),
          })
        pendingHitAt = Number.POSITIVE_INFINITY
        pendingTargetId = ''
        pendingDamage = 0
      }

      if (!approaching && fighting && pendingTargetId === '') {
        const archer = enemyRuntime.records.find(
          (enemy) => enemy.type === 'brigandArcher' && enemy.hp > 0,
        )
        if (archer && elapsed >= nextCastAt) {
          pendingTargetId = archer.id
          pendingDamage = REACHBLADE.cast.damage
          pendingHitAt = elapsed + REACHBLADE.cast.windupSeconds
          castHits += 1
          nextCastAt = elapsed + 0.8
        } else if (
          !archer &&
          (nextCloseAt === Number.POSITIVE_INFINITY || elapsed >= nextCloseAt)
        ) {
          const target = enemyRuntime.records.find((enemy) => enemy.hp > 0)
          if (target) {
            const attack = tryStartCloseAttack(combo, elapsed, player.stamina)
            combo = attack.combo
            if (
              attack.attack &&
              spendStamina(player, attack.attack.staminaCost)
            ) {
              pendingTargetId = target.id
              pendingDamage = attack.attack.damage
              pendingHitAt = elapsed + attack.attack.windupSeconds
              nextCloseAt =
                pendingHitAt + attack.attack.activeSeconds + fixedStep
            }
          }
        }
      }

      if (!fighting && retreatStartedAt === Number.POSITIVE_INFINITY) {
        retreatStartedAt = elapsed
        healthAtRetreat = player.health
      }
      updateVitals(player, fixedStep, approaching || retreating)
      elapsed += fixedStep
    }

    expect(castHits).toBe(2)
    expect(
      enemyRuntime.records.every((enemy) => enemy.hp === 0),
      JSON.stringify(
        enemyRuntime.records.map((enemy) => ({ id: enemy.id, hp: enemy.hp })),
      ),
    ).toBe(true)
    expect(maximumMeleeTokens).toBeLessThanOrEqual(ENEMY_ATTACK_TOKENS.meleeCap)
    expect(maximumArcherTokens).toBeLessThanOrEqual(
      ENEMY_ATTACK_TOKENS.archerCap,
    )
    expect(player.health).toBeGreaterThan(0)
    expect(player.health).toBeGreaterThan(healthAtRetreat)
    expect(playerDied).toBe(false)
  })
})
