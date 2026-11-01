import { useFrame } from '@react-three/fiber'
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import type { Group, Mesh } from 'three'
import {
  ENEMY_AI,
  ENEMY_DEATH,
  ENEMY_TYPES,
  type EnemyType,
} from '../../data/enemies'
import { PLAYER } from '../../data/player'
import { applyCombatDamage } from '../combat/combat'
import {
  cameraRayFilterPredicate,
  registerCameraExcludedCollider,
  unregisterCameraExcludedCollider,
} from '../player/cameraCollisionRegistry'
import { playerStore } from '../player/playerStore'
import { isUnarmed } from '../weapons/cordState'
import { weaponRuntime } from '../weapons/weaponRuntime'
import { heightAt } from '../world/terrain'
import {
  createAiStepResult,
  stepAi,
  type AiInputs,
  type AiMoveTarget,
} from './ai'
import {
  fireEnemyArrow,
  requestHoundCordBite,
  resetEnemyAtAnchor,
  type EnemyRecord,
} from './enemyRuntime'

type EnemyProps = { enemy: EnemyRecord }

const movement = { x: 0, y: 0, z: 0 }

function colliderRadius(type: EnemyType): number {
  return ENEMY_TYPES[type].collider.radius
}

function bodyHeight(type: EnemyType): number {
  return type === 'cliffHound'
    ? ENEMY_TYPES.cliffHound.collider.length
    : ENEMY_TYPES[type].collider.height
}

function colliderHalfHeight(type: EnemyType): number {
  return Math.max(0, bodyHeight(type) * 0.5 - colliderRadius(type))
}

function moveSpeedFor(type: EnemyType, intent: AiMoveTarget): number {
  const speed = ENEMY_TYPES[type].moveSpeed
  return intent === 'PatrolPoint'
    ? speed * ENEMY_AI.patrolSpeedMultiplier
    : speed
}

function canDrawBow(enemy: EnemyRecord): boolean {
  return (
    enemy.type === 'brigandArcher' &&
    enemy.phase === 'Alive' &&
    enemy.state === 'Attack' &&
    enemy.attackCooldown === 0 &&
    enemy.drawRemaining > 0
  )
}

export function Enemy({ enemy }: EnemyProps) {
  const body = useRef<RapierRigidBody>(null)
  const collider = useRef<RapierCollider>(null)
  const visual = useRef<Group>(null)
  const healthBar = useRef<Group>(null)
  const healthFill = useRef<Mesh>(null)
  const drawBar = useRef<Mesh>(null)
  const { world, rapier } = useRapier()
  const character = useRef(world.createCharacterController(0.01))
  const ray = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }))
  const aiResult = useRef(createAiStepResult())
  const aiInputs = useRef<AiInputs>({
    enemyType: enemy.type,
    distanceToPlayer: Infinity,
    distanceFromAnchor: 0,
    distanceToAnchor: 0,
    healthFraction: 1,
    lineOfSight: false,
    playerAlive: true,
    playerInSafeZone: false,
    stateElapsedSeconds: 0,
    attackCooldownSeconds: 0,
    attackWindupSeconds: 0,
  })
  const nextTranslation = useRef({ x: enemy.x, y: enemy.y, z: enemy.z })

  useEffect(() => {
    const controller = character.current
    const enemyCollider = collider.current
    controller.enableAutostep(0.35, 0.15, true)
    controller.enableSnapToGround(0.2)
    controller.setMaxSlopeClimbAngle(Math.PI / 4)
    controller.setMinSlopeSlideAngle((50 * Math.PI) / 180)
    if (enemyCollider) registerCameraExcludedCollider(enemyCollider.handle)
    return () => {
      if (enemyCollider) unregisterCameraExcludedCollider(enemyCollider.handle)
      world.removeCharacterController(controller)
    }
  }, [world])

  useFrame((_, rawDelta) => {
    const enemyBody = body.current
    const enemyCollider = collider.current
    const enemyVisual = visual.current
    if (!enemyBody || !enemyCollider || !enemyVisual) return
    const delta = Math.min(rawDelta, 1 / 30)
    const player = playerStore.getState()

    enemy.healthBarRemaining = Math.max(0, enemy.healthBarRemaining - delta)
    enemy.staggerRemaining = Math.max(0, enemy.staggerRemaining - delta)
    if (healthBar.current)
      healthBar.current.visible =
        enemy.phase === 'Alive' && enemy.healthBarRemaining > 0
    if (healthFill.current)
      healthFill.current.scale.x = Math.max(0, enemy.hp / enemy.maxHp)

    if (enemy.phase === 'Dying') {
      enemy.deathElapsed += delta
      enemyVisual.rotation.z =
        Math.min(1, enemy.deathElapsed / ENEMY_DEATH.fallSeconds) *
        (Math.PI * 0.5)
      if (enemy.deathElapsed >= ENEMY_DEATH.fallSeconds) {
        enemy.phase = 'Dead'
        enemyVisual.visible = false
        enemyCollider.setEnabled(false)
        enemyBody.setEnabled(false)
      }
      return
    }

    if (enemy.phase === 'Dead') {
      enemy.respawnElapsed += delta
      const playerAnchorX = player.position.x - enemy.anchorX
      const playerAnchorZ = player.position.z - enemy.anchorZ
      if (
        enemy.respawnElapsed >= ENEMY_DEATH.respawnSeconds &&
        Math.hypot(playerAnchorX, playerAnchorZ) >
          ENEMY_DEATH.respawnPlayerDistance
      ) {
        resetEnemyAtAnchor(enemy)
        enemyVisual.rotation.z = 0
        enemyVisual.visible = true
        enemyCollider.setEnabled(true)
        enemyBody.setEnabled(true)
        nextTranslation.current.x = enemy.x
        nextTranslation.current.y = enemy.y
        nextTranslation.current.z = enemy.z
        enemyBody.setTranslation(nextTranslation.current, true)
        enemyBody.setNextKinematicTranslation(nextTranslation.current)
      }
      return
    }

    enemyVisual.visible = true
    enemyVisual.rotation.z =
      enemy.staggerRemaining > 0
        ? Math.sin(enemy.staggerRemaining * 80) * 0.09
        : 0

    const toPlayerX = player.position.x - enemy.x
    const toPlayerY = player.position.y - enemy.y
    const toPlayerZ = player.position.z - enemy.z
    const distanceToPlayer = Math.hypot(toPlayerX, toPlayerZ)
    const fromAnchorX = enemy.x - enemy.anchorX
    const fromAnchorZ = enemy.z - enemy.anchorZ
    const distanceFromAnchor = Math.hypot(fromAnchorX, fromAnchorZ)
    const playerSafeDistance = Math.hypot(player.position.x, player.position.z)
    const enemySafeDistance = Math.hypot(enemy.x, enemy.z)

    let lineOfSight = false
    if (distanceToPlayer > 0) {
      const fullDistance = Math.hypot(toPlayerX, toPlayerY, toPlayerZ)
      const inverseDistance = fullDistance > 0 ? 1 / fullDistance : 0
      ray.current.origin.x = enemy.x
      ray.current.origin.y = enemy.y + colliderRadius(enemy.type)
      ray.current.origin.z = enemy.z
      ray.current.dir.x = toPlayerX * inverseDistance
      ray.current.dir.y = toPlayerY * inverseDistance
      ray.current.dir.z = toPlayerZ * inverseDistance
      const obstruction = world.castRay(
        ray.current,
        Math.max(0, fullDistance - PLAYER.collider.radius),
        true,
        rapier.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        enemyCollider,
        undefined,
        cameraRayFilterPredicate,
      )
      lineOfSight = obstruction === null
    }

    const inputs = aiInputs.current
    inputs.enemyType = enemy.type
    inputs.distanceToPlayer = distanceToPlayer
    inputs.distanceFromAnchor = distanceFromAnchor
    inputs.distanceToAnchor = distanceFromAnchor
    inputs.healthFraction = enemy.hp / enemy.maxHp
    inputs.lineOfSight = lineOfSight
    inputs.playerAlive = player.vitals.health > 0
    inputs.playerInSafeZone =
      playerSafeDistance <= ENEMY_AI.safeZoneRadius ||
      enemySafeDistance <= ENEMY_AI.safeZoneRadius
    inputs.stateElapsedSeconds = enemy.stateElapsed
    inputs.attackCooldownSeconds = enemy.attackCooldown
    inputs.attackWindupSeconds = enemy.drawRemaining

    const result = stepAi(enemy.state, inputs, delta, aiResult.current)
    enemy.state = result.state
    enemy.stateElapsed = result.stateElapsedSeconds
    enemy.attackCooldown = result.attackCooldownSeconds
    enemy.drawRemaining = result.attackWindupSeconds
    if (result.healAtAnchor) enemy.hp = enemy.maxHp
    if (
      distanceToPlayer > 0 &&
      (enemy.state === 'Alert' || enemy.state === 'Attack')
    ) {
      enemy.facingX = toPlayerX / distanceToPlayer
      enemy.facingZ = toPlayerZ / distanceToPlayer
      enemyVisual.rotation.y = Math.atan2(enemy.facingX, enemy.facingZ)
    }

    if (drawBar.current) {
      drawBar.current.visible = canDrawBow(enemy)
      drawBar.current.scale.x = Math.max(
        0.02,
        enemy.drawRemaining / ENEMY_TYPES.brigandArcher.drawSeconds,
      )
    }

    if (result.attack && enemy.staggerRemaining === 0) {
      if (enemy.type === 'brigandArcher') {
        fireEnemyArrow(
          enemy.x,
          enemy.y + 0.45,
          enemy.z,
          player.position.x,
          player.position.y,
          player.position.z,
        )
      } else {
        applyCombatDamage(
          player.vitals,
          ENEMY_TYPES[enemy.type].damage,
          isUnarmed(weaponRuntime.cord),
          player.invulnerable,
        )
        if (enemy.type === 'cliffHound')
          requestHoundCordBite(enemy.x, enemy.y, enemy.z)
      }
    }

    let targetX = enemy.x
    let targetZ = enemy.z
    let shouldMove = false
    const intent = result.moveTarget
    if (intent === 'PatrolPoint') {
      const hasRoute =
        enemy.patrolStartX !== enemy.patrolEndX ||
        enemy.patrolStartZ !== enemy.patrolEndZ
      if (hasRoute) {
        const towardEnd = enemy.patrolIndex % 2 === 0
        targetX = towardEnd ? enemy.patrolEndX : enemy.patrolStartX
        targetZ = towardEnd ? enemy.patrolEndZ : enemy.patrolStartZ
      } else {
        const pointCount = ENEMY_AI.patrolPointCount[enemy.id.length % 2]
        const angle =
          (Math.PI * 2 * (enemy.patrolIndex % pointCount)) / pointCount
        targetX = enemy.anchorX + Math.cos(angle) * ENEMY_AI.patrolRadius
        targetZ = enemy.anchorZ + Math.sin(angle) * ENEMY_AI.patrolRadius
      }
      if (
        Math.hypot(targetX - enemy.x, targetZ - enemy.z) <=
        ENEMY_AI.returnAnchorDistance
      )
        enemy.patrolIndex += 1
      shouldMove = true
    } else if (intent === 'Player') {
      targetX = player.position.x
      targetZ = player.position.z
      shouldMove = true
    } else if (intent === 'FlankPlayer') {
      const inverseDistance = distanceToPlayer > 0 ? 1 / distanceToPlayer : 0
      const flankSign = enemy.id.length % 2 === 0 ? 1 : -1
      targetX =
        player.position.x +
        toPlayerZ *
          inverseDistance *
          ENEMY_TYPES.cliffHound.attackRange *
          flankSign
      targetZ =
        player.position.z -
        toPlayerX *
          inverseDistance *
          ENEMY_TYPES.cliffHound.attackRange *
          flankSign
      shouldMove = true
    } else if (intent === 'AwayFromPlayer') {
      targetX = enemy.x - toPlayerX
      targetZ = enemy.z - toPlayerZ
      shouldMove = true
    } else if (intent === 'Anchor') {
      targetX = enemy.anchorX
      targetZ = enemy.anchorZ
      shouldMove = true
    } else if (
      enemy.type === 'brigandArcher' &&
      enemy.state === 'Attack' &&
      distanceToPlayer > ENEMY_TYPES.brigandArcher.keepAway.maximumDistance
    ) {
      targetX = player.position.x
      targetZ = player.position.z
      shouldMove = true
    }

    if (enemy.staggerRemaining > 0) shouldMove = false
    if (shouldMove) {
      const directionX = targetX - enemy.x
      const directionZ = targetZ - enemy.z
      const directionLength = Math.hypot(directionX, directionZ)
      if (directionLength > 0.001) {
        const distanceThisFrame = moveSpeedFor(enemy.type, intent) * delta
        movement.x =
          (directionX / directionLength) *
          Math.min(distanceThisFrame, directionLength)
        movement.y = 0
        movement.z =
          (directionZ / directionLength) *
          Math.min(distanceThisFrame, directionLength)
        character.current.computeColliderMovement(enemyCollider, movement)
        const corrected = character.current.computedMovement()
        enemy.x += corrected.x
        enemy.z += corrected.z
        enemy.y = heightAt(enemy.x, enemy.z) + bodyHeight(enemy.type) * 0.5
        nextTranslation.current.x = enemy.x
        nextTranslation.current.y = enemy.y
        nextTranslation.current.z = enemy.z
        enemyBody.setNextKinematicTranslation(nextTranslation.current)
        enemy.facingX = directionX / directionLength
        enemy.facingZ = directionZ / directionLength
        enemyVisual.rotation.y = Math.atan2(directionX, directionZ)
      }
    }
  })

  const radius = colliderRadius(enemy.type)
  const halfHeight = colliderHalfHeight(enemy.type)
  const color = ENEMY_TYPES[enemy.type].color
  const healthY = bodyHeight(enemy.type) * 0.5 + 0.8

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      position={[enemy.x, enemy.y, enemy.z]}
      colliders={false}
      lockRotations
      name={`enemy-${enemy.id}`}
    >
      <CapsuleCollider ref={collider} args={[halfHeight, radius]} />
      <group ref={visual}>
        {enemy.type === 'cliffHound' ? (
          <>
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[radius, halfHeight * 2, 6, 10]} />
              <meshStandardMaterial color={color} roughness={0.95} />
            </mesh>
            <mesh castShadow position={[0, 0.08, -0.48]}>
              <coneGeometry args={[0.22, 0.42, 6]} />
              <meshStandardMaterial color={color} roughness={0.95} />
            </mesh>
          </>
        ) : (
          <>
            <mesh castShadow>
              <capsuleGeometry args={[radius, halfHeight * 2, 8, 12]} />
              <meshStandardMaterial color={color} roughness={0.9} />
            </mesh>
            {enemy.type === 'roadBrigand' ? (
              <>
                <mesh castShadow position={[0.5, 0, 0]}>
                  <boxGeometry args={[0.08, 1.05, 0.12]} />
                  <meshStandardMaterial color="#6a6b68" metalness={0.45} />
                </mesh>
                <mesh
                  castShadow
                  position={[-0.5, 0.1, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.34, 0.34, 0.1, 10]} />
                  <meshStandardMaterial color="#5d5a50" metalness={0.35} />
                </mesh>
              </>
            ) : (
              <>
                <mesh castShadow position={[0.46, 0.1, 0]}>
                  <torusGeometry args={[0.38, 0.035, 6, 16, Math.PI]} />
                  <meshStandardMaterial color="#7a6044" roughness={0.9} />
                </mesh>
                <mesh ref={drawBar} position={[0, 0.88, 0]} visible={false}>
                  <boxGeometry args={[0.7, 0.06, 0.06]} />
                  <meshBasicMaterial color="#d2b984" />
                </mesh>
              </>
            )}
          </>
        )}
        <group ref={healthBar} position={[0, healthY, 0]} visible={false}>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.9, 0.1]} />
            <meshBasicMaterial color="#28251f" />
          </mesh>
          <mesh ref={healthFill} position={[0, 0, 0.02]}>
            <planeGeometry args={[0.84, 0.065]} />
            <meshBasicMaterial color="#9f493e" />
          </mesh>
        </group>
      </group>
    </RigidBody>
  )
}
