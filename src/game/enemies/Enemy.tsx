import { useFrame } from '@react-three/fiber'
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { Color, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import {
  CAMP_LEADER,
  ENEMY_AI,
  ENEMY_DEATH,
  ENEMY_PRESENTATION,
  ENEMY_ARROW,
  ENEMY_TYPES,
  ENEMY_VARIANTS,
  type EnemyType,
} from '../../data/enemies'
import { PLAYER } from '../../data/player'
import { applyCombatDamage } from '../combat/combat'
import { distanceSquaredPointToSegment } from '../combat/hitboxes'
import {
  cameraRayFilterPredicate,
  registerCameraExcludedCollider,
  unregisterCameraExcludedCollider,
} from '../player/cameraCollisionRegistry'
import { playerStore } from '../player/playerStore'
import { getWorldConfiguration } from '../scenes/sceneRuntime'
import { getPausableDelta } from '../pause/pauseRuntime'
import { ModelSlot } from '../models/ModelSlot'
import { isUnarmed } from '../weapons/cordState'
import { weaponRuntime } from '../weapons/weaponRuntime'
import {
  createAiStepResult,
  stepAi,
  type AiInputs,
  type AiMoveTarget,
} from './ai'
import {
  canEnemyRespawn,
  fireEnemyArrow,
  requestHoundCordBite,
  resetEnemyAtAnchor,
  sampleEnemyGroundHeight,
  type EnemyRecord,
} from './enemyRuntime'
import { advanceRespawnElapsed, canRespawnFromElapsed } from './spawns'

type EnemyProps = { enemy: EnemyRecord }

const movement = { x: 0, y: 0, z: 0 }

function colliderRadius(enemy: EnemyRecord): number {
  return ENEMY_TYPES[enemy.type].collider.radius * enemy.scale
}

function bodyHeight(enemy: EnemyRecord): number {
  const height =
    enemy.type === 'cliffHound'
      ? ENEMY_TYPES.cliffHound.collider.length
      : ENEMY_TYPES[enemy.type].collider.height
  return height * enemy.scale
}

function colliderHalfHeight(enemy: EnemyRecord): number {
  return Math.max(0, bodyHeight(enemy) * 0.5 - colliderRadius(enemy))
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
    enemy.drawRemaining > 0
  )
}

export function Enemy({ enemy }: EnemyProps) {
  const color = ENEMY_TYPES[enemy.type].color
  const baseBodyColor = useMemo(() => new Color(color), [color])
  const windupBodyColor = useMemo(
    () => new Color(ENEMY_PRESENTATION.meleeWindup.tintColor),
    [],
  )
  const body = useRef<RapierRigidBody>(null)
  const collider = useRef<RapierCollider>(null)
  const visual = useRef<Group>(null)
  const healthBar = useRef<Group>(null)
  const healthFill = useRef<Mesh>(null)
  const drawBar = useRef<Mesh>(null)
  const bodyMaterial = useRef<MeshStandardMaterial>(null)
  const sword = useRef<Mesh>(null)
  const { world, rapier } = useRapier()
  const character = useRef<ReturnType<
    typeof world.createCharacterController
  > | null>(null)
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
    const controller = world.createCharacterController(0.01)
    const enemyCollider = collider.current
    character.current = controller
    controller.enableAutostep(0.35, 0.15, true)
    controller.enableSnapToGround(0.2)
    controller.setMaxSlopeClimbAngle(Math.PI / 4)
    controller.setMinSlopeSlideAngle((50 * Math.PI) / 180)
    if (enemyCollider) registerCameraExcludedCollider(enemyCollider.handle)
    return () => {
      if (enemyCollider) unregisterCameraExcludedCollider(enemyCollider.handle)
      world.removeCharacterController(controller)
      character.current = null
    }
  }, [world])

  useFrame((_, rawDelta) => {
    const enemyBody = body.current
    const enemyCollider = collider.current
    const enemyVisual = visual.current
    const controller = character.current
    if (!enemyBody || !enemyCollider || !enemyVisual || !controller) return
    const delta = getPausableDelta(rawDelta)
    if (delta === 0) return
    const player = playerStore.getState()

    if (enemy.teleportRequested) {
      nextTranslation.current.x = enemy.x
      nextTranslation.current.y = enemy.y
      nextTranslation.current.z = enemy.z
      enemyBody.setEnabled(true)
      enemyCollider.setEnabled(true)
      enemyBody.setTranslation(nextTranslation.current, true)
      enemyBody.setNextKinematicTranslation(nextTranslation.current)
      enemyVisual.visible = true
      enemyVisual.rotation.z = 0
      enemy.teleportRequested = false
    }

    const wasStaggered = enemy.staggerRemaining > 0
    enemy.healthBarRemaining = Math.max(0, enemy.healthBarRemaining - delta)
    enemy.staggerRemaining = Math.max(0, enemy.staggerRemaining - delta)
    if (healthBar.current)
      healthBar.current.visible =
        enemy.phase === 'Alive' && enemy.healthBarRemaining > 0
    if (healthFill.current)
      healthFill.current.scale.x = Math.max(0, enemy.hp / enemy.maxHp)

    if (enemy.phase === 'Dying') {
      enemyCollider.setEnabled(false)
      enemy.deathElapsed += delta
      enemy.respawnElapsed = advanceRespawnElapsed(enemy.respawnElapsed, delta)
      enemyVisual.rotation.z =
        Math.min(1, enemy.deathElapsed / ENEMY_DEATH.fallSeconds) *
        (Math.PI * 0.5)
      if (enemy.deathElapsed >= ENEMY_DEATH.fallSeconds) {
        enemy.phase = 'Dead'
        enemyVisual.visible = false
        enemyBody.setEnabled(false)
      }
      return
    }

    if (enemy.phase === 'Dead') {
      enemy.respawnElapsed = advanceRespawnElapsed(enemy.respawnElapsed, delta)
      const playerAnchorX = player.position.x - enemy.anchorX
      const playerAnchorZ = player.position.z - enemy.anchorZ
      if (
        canEnemyRespawn(enemy) &&
        canRespawnFromElapsed(
          enemy.respawnElapsed,
          Math.hypot(playerAnchorX, playerAnchorZ),
        )
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
        ? Math.sin(
            enemy.staggerRemaining *
              ENEMY_PRESENTATION.stagger.angularFrequency,
          ) * ENEMY_PRESENTATION.stagger.maximumRotationRadians
        : 0

    const toPlayerX = player.position.x - enemy.x
    const toPlayerY = player.position.y - enemy.y
    const toPlayerZ = player.position.z - enemy.z
    const distanceToPlayer = Math.hypot(toPlayerX, toPlayerZ)
    const fromAnchorX = enemy.x - enemy.anchorX
    const fromAnchorZ = enemy.z - enemy.anchorZ
    const hasPatrolRoute =
      enemy.patrolStartX !== enemy.patrolEndX ||
      enemy.patrolStartZ !== enemy.patrolEndZ
    const distanceFromAnchor = hasPatrolRoute
      ? Math.sqrt(
          distanceSquaredPointToSegment(
            enemy.x,
            0,
            enemy.z,
            enemy.patrolStartX,
            0,
            enemy.patrolStartZ,
            enemy.patrolEndX,
            0,
            enemy.patrolEndZ,
          ),
        )
      : Math.hypot(fromAnchorX, fromAnchorZ)
    const playerSafeDistance = Math.hypot(player.position.x, player.position.z)
    const enemySafeDistance = Math.hypot(enemy.x, enemy.z)

    let lineOfSight = false
    if (distanceToPlayer > 0) {
      const fullDistance = Math.hypot(toPlayerX, toPlayerY, toPlayerZ)
      const inverseDistance = fullDistance > 0 ? 1 / fullDistance : 0
      ray.current.origin.x = enemy.x
      ray.current.origin.y = enemy.y + colliderRadius(enemy)
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
        player.collider ?? undefined,
        undefined,
        cameraRayFilterPredicate,
      )
      lineOfSight = obstruction === null
    }

    const inputs = aiInputs.current
    inputs.enemyType = enemy.type
    inputs.distanceToPlayer = distanceToPlayer
    inputs.distanceFromAnchor = distanceFromAnchor
    inputs.distanceToAnchor = Math.hypot(fromAnchorX, fromAnchorZ)
    inputs.healthFraction = enemy.hp / enemy.maxHp
    inputs.lineOfSight = lineOfSight
    inputs.playerAlive = player.vitals.health > 0
    inputs.playerInSafeZone =
      getWorldConfiguration().safeZoneEnabled &&
      (playerSafeDistance <= ENEMY_AI.safeZoneRadius ||
        enemySafeDistance <= ENEMY_AI.safeZoneRadius)
    inputs.stateElapsedSeconds = enemy.stateElapsed
    inputs.attackCooldownSeconds = enemy.attackCooldown
    inputs.attackWindupSeconds = enemy.drawRemaining
    inputs.staggered = wasStaggered

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
        ENEMY_PRESENTATION.brigandArcher.drawBarMinimumScale,
        enemy.drawRemaining / ENEMY_TYPES.brigandArcher.drawSeconds,
      )
    }

    const meleeWindupActive =
      enemy.type !== 'brigandArcher' &&
      enemy.drawRemaining > 0 &&
      enemy.staggerRemaining === 0
    if (bodyMaterial.current)
      bodyMaterial.current.color.copy(
        meleeWindupActive ? windupBodyColor : baseBodyColor,
      )
    if (sword.current)
      sword.current.rotation.z =
        enemy.type === 'roadBrigand' && meleeWindupActive
          ? ENEMY_PRESENTATION.meleeWindup.brigandSwordRaiseRadians
          : 0
    enemyVisual.scale.y =
      enemy.type === 'cliffHound' && meleeWindupActive
        ? ENEMY_PRESENTATION.meleeWindup.houndCrouchScaleY
        : 1

    if (result.attack && enemy.staggerRemaining === 0) {
      if (enemy.type === 'brigandArcher') {
        fireEnemyArrow(
          enemy.x,
          enemy.y + ENEMY_ARROW.releaseHeight,
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
          requestHoundCordBite(
            enemy.x,
            enemy.y + ENEMY_TYPES.cliffHound.collider.length * 0.5,
            enemy.z,
          )
      }
    }

    let targetX = enemy.x
    let targetZ = enemy.z
    let shouldMove = false
    const intent = result.moveTarget
    if (intent === 'PatrolPoint') {
      if (hasPatrolRoute) {
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
        controller.computeColliderMovement(enemyCollider, movement)
        const corrected = controller.computedMovement()
        enemy.x += corrected.x
        enemy.z += corrected.z
        enemy.y =
          sampleEnemyGroundHeight(enemy.x, enemy.z) + bodyHeight(enemy) * 0.5
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

  const radius = colliderRadius(enemy)
  const halfHeight = colliderHalfHeight(enemy)
  const healthY =
    bodyHeight(enemy) * 0.5 + ENEMY_PRESENTATION.healthBar.verticalOffset

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
        <ModelSlot
          model={
            enemy.type === 'cliffHound'
              ? 'cliffHound'
              : enemy.type === 'brigandArcher'
                ? 'brigandArcher'
                : 'roadBrigand'
          }
          loadedScale={enemy.scale}
          uniqueMaterials
          onReady={(object) => {
            const bodyNode = object.getObjectByName(
              enemy.type === 'cliffHound' ? 'body' : 'pelvis',
            ) as Mesh | undefined
            if (bodyNode)
              bodyMaterial.current = bodyNode.material as MeshStandardMaterial
            const swordNode = object.getObjectByName('sword') as
              Mesh | undefined
            if (swordNode) sword.current = swordNode
            const sash = object.getObjectByName('leaderSash')
            if (sash) sash.visible = enemy.variant === ENEMY_VARIANTS.campLeader
          }}
          fallback={
            enemy.type === 'cliffHound' ? (
              <>
                <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                  <capsuleGeometry
                    args={[
                      radius,
                      halfHeight * 2,
                      ENEMY_PRESENTATION.hound.bodyCapSegments,
                      ENEMY_PRESENTATION.hound.bodyRadialSegments,
                    ]}
                  />
                  <meshStandardMaterial
                    ref={bodyMaterial}
                    color={color}
                    roughness={ENEMY_PRESENTATION.hound.bodyRoughness}
                  />
                </mesh>
                <mesh
                  castShadow
                  position={[
                    ENEMY_PRESENTATION.hound.headPosition[0],
                    ENEMY_PRESENTATION.hound.headPosition[1],
                    ENEMY_PRESENTATION.hound.headPosition[2],
                  ]}
                >
                  <coneGeometry
                    args={[
                      ENEMY_PRESENTATION.hound.headRadius,
                      ENEMY_PRESENTATION.hound.headLength,
                      ENEMY_PRESENTATION.hound.headSegments,
                    ]}
                  />
                  <meshStandardMaterial
                    color={color}
                    roughness={ENEMY_PRESENTATION.hound.bodyRoughness}
                  />
                </mesh>
              </>
            ) : (
              <>
                <mesh castShadow>
                  <capsuleGeometry
                    args={[
                      radius,
                      halfHeight * 2,
                      ENEMY_PRESENTATION.humanoid.bodyCapSegments,
                      ENEMY_PRESENTATION.humanoid.bodyRadialSegments,
                    ]}
                  />
                  <meshStandardMaterial
                    ref={bodyMaterial}
                    color={color}
                    roughness={ENEMY_PRESENTATION.humanoid.bodyRoughness}
                  />
                </mesh>
                {enemy.type === 'roadBrigand' ? (
                  <>
                    <mesh
                      ref={sword}
                      castShadow
                      position={[
                        ENEMY_PRESENTATION.roadBrigand.swordPosition[0] *
                          enemy.scale,
                        ENEMY_PRESENTATION.roadBrigand.swordPosition[1] *
                          enemy.scale,
                        ENEMY_PRESENTATION.roadBrigand.swordPosition[2] *
                          enemy.scale,
                      ]}
                    >
                      <boxGeometry
                        args={[
                          ENEMY_PRESENTATION.roadBrigand.swordSize[0] *
                            enemy.scale,
                          ENEMY_PRESENTATION.roadBrigand.swordSize[1] *
                            enemy.scale,
                          ENEMY_PRESENTATION.roadBrigand.swordSize[2] *
                            enemy.scale,
                        ]}
                      />
                      <meshStandardMaterial
                        color={ENEMY_PRESENTATION.roadBrigand.swordColor}
                        metalness={
                          ENEMY_PRESENTATION.roadBrigand.swordMetalness
                        }
                      />
                    </mesh>
                    {enemy.variant === ENEMY_VARIANTS.campLeader ? (
                      <mesh
                        castShadow
                        rotation={[
                          0,
                          0,
                          ENEMY_PRESENTATION.meleeWindup
                            .brigandSwordRaiseRadians / 2,
                        ]}
                      >
                        <boxGeometry
                          args={[
                            radius * 2,
                            ENEMY_PRESENTATION.healthBar.backgroundHeight *
                              enemy.scale,
                            ENEMY_PRESENTATION.roadBrigand.swordSize[2] *
                              enemy.scale,
                          ]}
                        />
                        <meshStandardMaterial color={CAMP_LEADER.sashColor} />
                      </mesh>
                    ) : null}
                    <mesh
                      castShadow
                      position={[
                        ENEMY_PRESENTATION.roadBrigand.shieldPosition[0] *
                          enemy.scale,
                        ENEMY_PRESENTATION.roadBrigand.shieldPosition[1] *
                          enemy.scale,
                        ENEMY_PRESENTATION.roadBrigand.shieldPosition[2] *
                          enemy.scale,
                      ]}
                      rotation={[Math.PI / 2, 0, 0]}
                    >
                      <cylinderGeometry
                        args={[
                          ENEMY_PRESENTATION.roadBrigand.shieldRadius *
                            enemy.scale,
                          ENEMY_PRESENTATION.roadBrigand.shieldRadius *
                            enemy.scale,
                          ENEMY_PRESENTATION.roadBrigand.shieldDepth *
                            enemy.scale,
                          ENEMY_PRESENTATION.roadBrigand.shieldSegments,
                        ]}
                      />
                      <meshStandardMaterial
                        color={ENEMY_PRESENTATION.roadBrigand.shieldColor}
                        metalness={
                          ENEMY_PRESENTATION.roadBrigand.shieldMetalness
                        }
                      />
                    </mesh>
                  </>
                ) : (
                  <>
                    <mesh
                      castShadow
                      position={[
                        ENEMY_PRESENTATION.brigandArcher.bowPosition[0],
                        ENEMY_PRESENTATION.brigandArcher.bowPosition[1],
                        ENEMY_PRESENTATION.brigandArcher.bowPosition[2],
                      ]}
                    >
                      <torusGeometry
                        args={[
                          ENEMY_PRESENTATION.brigandArcher.bowRadius,
                          ENEMY_PRESENTATION.brigandArcher.bowTubeRadius,
                          ENEMY_PRESENTATION.brigandArcher.bowRadialSegments,
                          ENEMY_PRESENTATION.brigandArcher.bowTubularSegments,
                          Math.PI,
                        ]}
                      />
                      <meshStandardMaterial
                        color={ENEMY_PRESENTATION.brigandArcher.bowColor}
                        roughness={
                          ENEMY_PRESENTATION.brigandArcher.bowRoughness
                        }
                      />
                    </mesh>
                  </>
                )}
              </>
            )
          }
        />
        {enemy.type === 'brigandArcher' && (
          <mesh
            ref={drawBar}
            position={[0, ENEMY_PRESENTATION.brigandArcher.drawBarPositionY, 0]}
            visible={false}
          >
            <boxGeometry
              args={[
                ENEMY_PRESENTATION.brigandArcher.drawBarWidth,
                ENEMY_PRESENTATION.brigandArcher.drawBarHeight,
                ENEMY_PRESENTATION.brigandArcher.drawBarDepth,
              ]}
            />
            <meshBasicMaterial
              color={ENEMY_PRESENTATION.brigandArcher.drawBarColor}
            />
          </mesh>
        )}
        <group ref={healthBar} position={[0, healthY, 0]} visible={false}>
          <mesh position={[0, 0, ENEMY_PRESENTATION.healthBar.backgroundDepth]}>
            <planeGeometry
              args={[
                ENEMY_PRESENTATION.healthBar.backgroundWidth,
                ENEMY_PRESENTATION.healthBar.backgroundHeight,
              ]}
            />
            <meshBasicMaterial
              color={ENEMY_PRESENTATION.healthBar.backgroundColor}
            />
          </mesh>
          <mesh
            ref={healthFill}
            position={[0, 0, ENEMY_PRESENTATION.healthBar.fillDepth]}
          >
            <planeGeometry
              args={[
                ENEMY_PRESENTATION.healthBar.fillWidth,
                ENEMY_PRESENTATION.healthBar.fillHeight,
              ]}
            />
            <meshBasicMaterial color={ENEMY_PRESENTATION.healthBar.fillColor} />
          </mesh>
        </group>
      </group>
    </RigidBody>
  )
}
