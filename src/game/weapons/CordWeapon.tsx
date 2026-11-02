import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  Vector3,
} from 'three'
import { EFFECTS } from '../../data/effects'
import { ENEMY_ATTACK, ENEMY_TYPES } from '../../data/enemies'
import { TASSEL_REWARD } from '../../data/quests'
import { REACHBLADE, TRAINING_DUMMIES } from '../../data/weapons'
import { ZONE } from '../../data/zone'
import {
  initialComboState,
  isTargetInArc,
  createOutgoingHitResult,
  resolveStrengthHit,
  selectFlatArcTargets,
  shoveDamage,
  tryStartCloseAttack,
  type CloseAttack,
} from '../combat/combat'
import {
  capsuleOverlapsPoint,
  distanceSquaredPointToSegment,
} from '../combat/hitboxes'
import { houndBiteCutsSimulatedRope } from '../enemies/ai'
import {
  angleFromEnemyFacing,
  damageEnemy,
  enemyRuntime,
  registerHoundBiteHandler,
  type EnemyRecord,
} from '../enemies/enemyRuntime'
import {
  effectRuntime,
  getEffectMultipliers,
  hasStrength,
  isHeelstonePassRunning,
  lineCarriesEffect,
  makeCarriedLinePlain,
} from '../effects/effectRuntime'
import {
  getHollowRuntimeSnapshot,
  hitMarkedSnagPost,
} from '../hollow/hollowRuntime'
import {
  getPausableDelta,
  getPausableRawDelta,
  getPauseRuntimeSnapshot,
} from '../pause/pauseRuntime'
import {
  consumeInput,
  consumeReleased,
  inputHeld,
  isGameplayInputLocked,
  isDoubleTap,
} from '../player/input'
import { playerStore } from '../player/playerStore'
import { getQuestRuntimeSnapshot } from '../quest/questRuntime'
import { getWorldConfiguration } from '../scenes/sceneRuntime'
import { spendStamina } from '../player/vitals'
import {
  canCloseStrike,
  canCordBeCut,
  initialCordState,
  step,
  type CordState,
} from './cordState'
import {
  recordCameraDistanceWhileOut,
  registerForceCut,
  registerHoldCordOutForPerf,
  registerWeaponReset,
  recordDummyDamage,
  isWeaponPresentInScene,
  setDroppedBladeScene,
  registerDebugDropBlade,
  setCordState,
  weaponRuntime,
} from './weaponRuntime'
import {
  createVerletRope,
  stepDroppedBlade,
  stepVerletRope,
} from './verletRope'

type PendingAction =
  | { kind: 'close'; remaining: number; attack: CloseAttack }
  | { kind: 'cast' | 'arc'; remaining: number; x: number; z: number }

const hand = new Vector3()
const blade = new Vector3(0, 1.35, 0)
const aimDirection = new Vector3(0, 0, -1)
const castDirection = new Vector3(0, 0, -1)
const toHand = new Vector3()
const outgoingHit = createOutgoingHitResult()
const arcTargets = TRAINING_DUMMIES.map((dummy) => ({
  id: dummy.id,
  x: dummy.position[0],
  z: dummy.position[2],
}))

function bladeOverlapsEnemy(enemy: EnemyRecord): boolean {
  const stats = ENEMY_TYPES[enemy.type]
  const radius = stats.collider.radius * enemy.scale
  const bodyHeight =
    enemy.type === 'cliffHound'
      ? ENEMY_TYPES.cliffHound.collider.length
      : ENEMY_TYPES[enemy.type].collider.height
  const halfSegment = Math.max(0, bodyHeight * enemy.scale * 0.5 - radius)
  const combinedRadius = REACHBLADE.bladeHitRadius + radius
  return (
    distanceSquaredPointToSegment(
      blade.x,
      blade.y,
      blade.z,
      enemy.x,
      enemy.y - halfSegment,
      enemy.z,
      enemy.x,
      enemy.y + halfSegment,
      enemy.z,
    ) <=
    combinedRadius * combinedRadius
  )
}

export function CordWeapon() {
  const { camera } = useThree()
  const bladeMesh = useRef<Mesh>(null)
  const tasselMesh = useRef<Mesh>(null)
  const passHighlight = useRef<Mesh>(null)
  const cord = useRef<CordState>(weaponRuntime.cord)
  const combo = useRef(initialComboState())
  const pending = useRef<PendingAction | null>(null)
  const lastQTap = useRef(Number.NEGATIVE_INFINITY)
  const skipAimRelease = useRef(false)
  const closeActiveRemaining = useRef(0)
  const droppedVelocity = useRef(0)
  const debugHoldOut = useRef(false)
  const rope = useRef(
    createVerletRope({ x: 0, y: 1.35, z: 0 }, { x: 0, y: 1.35, z: 0 }),
  )
  const aimPositions = useRef(new Float32Array(6))

  const ropeGeometry = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new BufferAttribute(rope.current.positions, 3),
    )
    return geometry
  }, [])
  const aimGeometry = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new BufferAttribute(aimPositions.current, 3),
    )
    return geometry
  }, [])
  const ropeObject = useMemo(
    () =>
      new Line(
        ropeGeometry,
        new LineBasicMaterial({ color: 0x8a7048, linewidth: 2 }),
      ),
    [ropeGeometry],
  )
  const aimObject = useMemo(() => {
    const line = new Line(
      aimGeometry,
      new LineBasicMaterial({
        color: 0xead9ad,
        transparent: true,
        opacity: 0.65,
      }),
    )
    line.visible = false
    return line
  }, [aimGeometry])

  const updateCord = useCallback((next: CordState) => {
    const previousMode = cord.current.mode
    cord.current = next
    setCordState(next)
    if (previousMode !== next.mode && next.mode === 'Dropped')
      setDroppedBladeScene(getWorldConfiguration().scene)
    else if (next.mode === 'InHand') setDroppedBladeScene(null)
    if (previousMode !== next.mode && next.mode === 'Cut')
      makeCarriedLinePlain('cut')
    else if (previousMode !== next.mode && next.mode === 'Dropped')
      makeCarriedLinePlain('stop')
  }, [])

  const cutCordAtHoundPoint = useCallback(
    (x: number, y: number, z: number): boolean => {
      if (
        !houndBiteCutsSimulatedRope(
          cord.current,
          x,
          y,
          z,
          rope.current.positions,
          rope.current.activePoints,
        )
      )
        return false
      updateCord(step(cord.current, { type: 'cut' }))
      return true
    },
    [updateCord],
  )

  const damageDummy = (
    dummyId: string,
    damage: number,
    staggerSeconds: number,
    nowSeconds: number,
  ) => {
    recordDummyDamage({
      dummyId,
      damage,
      staggerSeconds,
      atSeconds: nowSeconds,
    })
  }

  const strikeNearest = (
    damage: number,
    arcDegrees: number,
    reach: number,
    nowSeconds: number,
    staggerSeconds = 0,
    kind: 'close' | 'shove' = 'close',
    comboIndex?: number,
  ) => {
    const position = playerStore.getState().position
    if (getWorldConfiguration().trainingDummiesEnabled) {
      for (const dummy of TRAINING_DUMMIES) {
        if (
          isTargetInArc(
            position.x,
            position.z,
            aimDirection.x,
            aimDirection.z,
            dummy.position[0],
            dummy.position[2],
            reach,
            arcDegrees,
          )
        ) {
          damageDummy(dummy.id, damage, staggerSeconds, nowSeconds)
          return
        }
      }
    }
    for (const enemy of enemyRuntime.records) {
      if (
        enemy.phase === 'Alive' &&
        isTargetInArc(
          position.x,
          position.z,
          aimDirection.x,
          aimDirection.z,
          enemy.x,
          enemy.z,
          reach,
          arcDegrees,
        )
      ) {
        damageEnemy(enemy.id, damage, {
          kind,
          comboIndex,
          staggerSeconds,
        })
        return
      }
    }
  }

  useEffect(() => {
    setCordState(cord.current)
    registerForceCut(() => {
      updateCord(step(cord.current, { type: 'cut' }))
    })
    registerHoundBiteHandler(cutCordAtHoundPoint)
    registerHoldCordOutForPerf((enabled) => {
      debugHoldOut.current = enabled
      pending.current = null
      if (enabled) {
        const player = playerStore.getState().position
        hand.set(player.x + 0.28, player.y + 0.45, player.z)
        camera.getWorldDirection(castDirection)
        castDirection.y = 0
        castDirection.normalize()
        blade
          .copy(hand)
          .addScaledVector(castDirection, REACHBLADE.maxCordLength)
        updateCord(step(initialCordState(), { type: 'castRelease' }))
      } else {
        updateCord(initialCordState())
        blade.copy(hand)
      }
    })
    registerWeaponReset(() => {
      debugHoldOut.current = false
      updateCord(initialCordState())
      combo.current = initialComboState()
      pending.current = null
      lastQTap.current = Number.NEGATIVE_INFINITY
      skipAimRelease.current = false
      closeActiveRemaining.current = 0
      droppedVelocity.current = 0
      blade.copy(hand)
      ropeObject.visible = false
      aimObject.visible = false
      if (bladeMesh.current) bladeMesh.current.position.copy(blade)
    })
    if (import.meta.env.DEV)
      registerDebugDropBlade(() => {
        debugHoldOut.current = false
        pending.current = null
        camera.getWorldDirection(castDirection)
        castDirection.y = 0
        castDirection.normalize()
        blade
          .copy(hand)
          .addScaledVector(
            castDirection,
            REACHBLADE.stop.pickupRadius + REACHBLADE.bladeHitRadius,
          )
        updateCord(
          step(step(initialCordState(), { type: 'castRelease' }), {
            type: 'stopDoubleTap',
          }),
        )
        droppedVelocity.current = 0
        return true
      })
    return () => {
      registerForceCut(null)
      registerHoundBiteHandler(null)
      registerHoldCordOutForPerf(null)
      registerWeaponReset(null)
      if (import.meta.env.DEV) registerDebugDropBlade(null)
      ropeGeometry.dispose()
      aimGeometry.dispose()
      ;(ropeObject.material as LineBasicMaterial).dispose()
      ;(aimObject.material as LineBasicMaterial).dispose()
    }
  }, [
    aimGeometry,
    aimObject,
    camera,
    cutCordAtHoundPoint,
    ropeGeometry,
    ropeObject,
    updateCord,
  ])

  useFrame((_, rawDelta) => {
    const rawGameplayDelta = getPausableRawDelta(rawDelta)
    const delta = getPausableDelta(rawDelta)
    let launchedThisFrame = false
    closeActiveRemaining.current = Math.max(
      0,
      closeActiveRemaining.current - delta,
    )
    const now = getPauseRuntimeSnapshot().elapsedSeconds
    const player = playerStore.getState()
    const worldConfiguration = getWorldConfiguration()
    const weaponPresent = isWeaponPresentInScene(
      cord.current.mode,
      worldConfiguration.scene,
      weaponRuntime.droppedScene,
    )
    if (player.death.phase !== 'Alive') return
    if (isGameplayInputLocked()) {
      pending.current = null
      aimObject.visible = false
      return
    }
    if (isHeelstonePassRunning()) {
      pending.current = null
      aimObject.visible = false
    }
    camera.getWorldDirection(aimDirection)
    aimDirection.y = 0
    aimDirection.normalize()
    hand.set(
      player.position.x + 0.28,
      player.position.y + 0.45,
      player.position.z,
    )
    if (debugHoldOut.current) {
      if (cord.current.mode !== 'Out')
        updateCord(step(initialCordState(), { type: 'castRelease' }))
      blade.copy(hand).addScaledVector(castDirection, REACHBLADE.maxCordLength)
    }

    if (!isHeelstonePassRunning() && consumeInput('recall')) {
      if (
        isDoubleTap(
          lastQTap.current,
          now,
          REACHBLADE.stop.doubleTapWindowSeconds,
        )
      ) {
        updateCord(step(cord.current, { type: 'stopDoubleTap' }))
      } else {
        updateCord(step(cord.current, { type: 'recallPressed' }))
      }
      lastQTap.current = now
    }

    const closePressed =
      !isHeelstonePassRunning() && consumeInput('closeStrike')
    if (closePressed && inputHeld('aim') && cord.current.mode === 'InHand') {
      if (spendStamina(player.vitals, REACHBLADE.flatArc.staminaCost)) {
        pending.current = {
          kind: 'arc',
          remaining: REACHBLADE.flatArc.windupSeconds,
          x: aimDirection.x,
          z: aimDirection.z,
        }
        skipAimRelease.current = true
      }
    } else if (closePressed && !inputHeld('aim')) {
      if (canCloseStrike(cord.current) && pending.current === null) {
        const result = tryStartCloseAttack(
          combo.current,
          now,
          player.vitals.stamina,
        )
        combo.current = result.combo
        if (
          result.attack &&
          spendStamina(player.vitals, result.attack.staminaCost)
        ) {
          pending.current = {
            kind: 'close',
            remaining: result.attack.windupSeconds,
            attack: result.attack,
          }
        }
      } else if (cord.current.mode === 'Cut') {
        strikeNearest(
          shoveDamage(),
          REACHBLADE.close.arcDegrees,
          REACHBLADE.close.reach,
          now,
          0,
          'shove',
        )
      }
    }

    if (!isHeelstonePassRunning() && consumeReleased('aim')) {
      if (skipAimRelease.current) {
        skipAimRelease.current = false
      } else if (cord.current.mode === 'InHand' && pending.current === null) {
        if (spendStamina(player.vitals, REACHBLADE.cast.staminaCost)) {
          pending.current = {
            kind: 'cast',
            remaining: REACHBLADE.cast.windupSeconds,
            x: aimDirection.x,
            z: aimDirection.z,
          }
        }
      }
    }

    if (pending.current) {
      pending.current.remaining -= delta
      if (pending.current.remaining <= 0) {
        const action = pending.current
        pending.current = null
        if (action.kind === 'close') {
          resolveStrengthHit(
            action.attack.damage,
            REACHBLADE.cast.staggerSeconds,
            'close',
            hasStrength(),
            lineCarriesEffect(),
            outgoingHit,
          )
          closeActiveRemaining.current = action.attack.activeSeconds
          strikeNearest(
            outgoingHit.damage,
            REACHBLADE.close.arcDegrees,
            REACHBLADE.close.reach,
            now,
            outgoingHit.staggerSeconds,
            'close',
            action.attack.index,
          )
        } else {
          castDirection.set(action.x, 0, action.z).normalize()
          blade.copy(hand)
          if (action.kind === 'cast') {
            updateCord(step(cord.current, { type: 'castRelease' }))
            launchedThisFrame = true
          } else {
            updateCord(step(cord.current, { type: 'arcRelease' }))
            blade.addScaledVector(
              castDirection,
              (REACHBLADE.flatArc.minimumRadius +
                REACHBLADE.flatArc.maximumRadius) /
                2,
            )
            let hitCount = 0
            resolveStrengthHit(
              REACHBLADE.flatArc.damage,
              REACHBLADE.cast.staggerSeconds,
              'cast',
              hasStrength(),
              lineCarriesEffect(),
              outgoingHit,
            )
            const arcDamage = outgoingHit.damage
            const arcStagger = outgoingHit.staggerSeconds
            if (worldConfiguration.trainingDummiesEnabled) {
              const selected = selectFlatArcTargets(
                arcTargets,
                player.position.x,
                player.position.z,
                castDirection.x,
                castDirection.z,
              )
              for (const target of selected) {
                damageDummy(target.id, arcDamage, arcStagger, now)
                hitCount += 1
              }
            }
            for (const enemy of enemyRuntime.records) {
              if (hitCount >= REACHBLADE.flatArc.maximumTargets) break
              if (
                enemy.phase === 'Alive' &&
                isTargetInArc(
                  player.position.x,
                  player.position.z,
                  castDirection.x,
                  castDirection.z,
                  enemy.x,
                  enemy.z,
                  REACHBLADE.flatArc.maximumRadius,
                  REACHBLADE.flatArc.arcDegrees,
                  REACHBLADE.flatArc.minimumRadius,
                )
              ) {
                damageEnemy(enemy.id, arcDamage, {
                  kind: 'arc',
                  breaksGuard:
                    ENEMY_ATTACK.breaksGuardByDefault ||
                    outgoingHit.breaksGuard,
                  staggerSeconds: arcStagger,
                })
                hitCount += 1
              }
            }
            updateCord(step(cord.current, { type: 'hit' }))
          }
        }
      }
    }

    if (cord.current.mode === 'InHand') {
      blade.copy(hand).addScaledVector(aimDirection, 0.3)
    } else if (
      cord.current.mode === 'Out' &&
      !launchedThisFrame &&
      !debugHoldOut.current
    ) {
      blade.addScaledVector(castDirection, REACHBLADE.cast.travelSpeed * delta)
      const distance = blade.distanceTo(hand)
      let hitTarget = false
      const multipliers = getEffectMultipliers()
      resolveStrengthHit(
        REACHBLADE.cast.damage,
        REACHBLADE.cast.staggerSeconds,
        'cast',
        hasStrength(),
        lineCarriesEffect(),
        outgoingHit,
      )
      const castDamage = outgoingHit.damage
      const castStagger = outgoingHit.staggerSeconds
      if (worldConfiguration.trainingDummiesEnabled) {
        for (const dummy of TRAINING_DUMMIES) {
          const dx = blade.x - dummy.position[0]
          const dz = blade.z - dummy.position[2]
          if (dx * dx + dz * dz <= REACHBLADE.bladeHitRadius ** 2) {
            damageDummy(dummy.id, castDamage, castStagger, now)
            updateCord(step(cord.current, { type: 'hit' }))
            hitTarget = true
            break
          }
        }
      }
      if (!hitTarget && worldConfiguration.scene === 'hollow') {
        const snag = getHollowRuntimeSnapshot().snag
        const snagX = blade.x - snag.postX
        const snagZ = blade.z - snag.postZ
        const snagRadius =
          REACHBLADE.bladeHitRadius +
          ZONE.hollow.presentation.snagPost.bottomRadius
        if (
          snagX * snagX + snagZ * snagZ <= snagRadius * snagRadius &&
          hitMarkedSnagPost(
            player.position.x,
            player.position.z,
            ZONE.hollow.snagBasePullSpeed,
            multipliers.castPullForce,
          )
        ) {
          updateCord(step(cord.current, { type: 'hit' }))
          hitTarget = true
        }
      }
      if (!hitTarget) {
        for (const enemy of enemyRuntime.records) {
          if (enemy.phase !== 'Alive') continue
          if (bladeOverlapsEnemy(enemy)) {
            damageEnemy(enemy.id, castDamage, {
              kind: 'cast',
              angleFromFacingDegrees: angleFromEnemyFacing(
                enemy,
                player.position.x,
                player.position.z,
              ),
              breaksGuard:
                ENEMY_ATTACK.breaksGuardByDefault || outgoingHit.breaksGuard,
              staggerSeconds: castStagger,
            })
            updateCord(step(cord.current, { type: 'hit' }))
            hitTarget = true
            break
          }
        }
      }
      if (!hitTarget && distance >= REACHBLADE.maxCordLength) {
        blade
          .copy(hand)
          .addScaledVector(castDirection, REACHBLADE.maxCordLength)
        updateCord(step(cord.current, { type: 'maxRange' }))
      }
    }

    if (cord.current.mode === 'Out' || cord.current.mode === 'Returning') {
      if (worldConfiguration.trainingDummiesEnabled) {
        for (const dummy of TRAINING_DUMMIES) {
          if (
            dummy.cordCutter &&
            capsuleOverlapsPoint(
              dummy.position[0],
              worldConfiguration.sampleHeight(
                dummy.position[0],
                dummy.position[2],
              ) + dummy.position[1],
              dummy.position[2],
              hand.x,
              hand.y,
              hand.z,
              blade.x,
              blade.y,
              blade.z,
              REACHBLADE.rope.collisionRadius + REACHBLADE.cutterVolumeRadius,
            ) &&
            canCordBeCut(cord.current)
          ) {
            updateCord(step(cord.current, { type: 'cut' }))
            break
          }
        }
      }
    }

    if (cord.current.mode === 'Returning') {
      toHand.copy(hand).sub(blade)
      const distance = toHand.length()
      const recallSpeed =
        REACHBLADE.maxCordLength / REACHBLADE.recall.fullLengthSeconds
      if (distance <= recallSpeed * delta) {
        blade.copy(hand)
        updateCord(step(cord.current, { type: 'returned' }))
      } else {
        blade.addScaledVector(toHand, (recallSpeed * delta) / distance)
      }
    } else if (cord.current.mode === 'Cut') {
      // Re-tie is an elapsed-time rule, not a motion integration. Keeping the
      // unclamped render delta prevents the 2 s timer from stretching at low FPS.
      updateCord(step(cord.current, { type: 'tick' }, rawGameplayDelta))
      if (cord.current.retieRemaining <= 0) {
        updateCord(step(cord.current, { type: 'retieDone' }))
        blade.copy(hand)
      }
    } else if (cord.current.mode === 'Dropped' && weaponPresent) {
      droppedVelocity.current = stepDroppedBlade(
        blade,
        droppedVelocity.current,
        delta,
        worldConfiguration.sampleHeight,
      )
      const pickupX = blade.x - player.position.x
      const pickupZ = blade.z - player.position.z
      if (
        pickupX * pickupX + pickupZ * pickupZ <=
        REACHBLADE.stop.pickupRadius ** 2
      ) {
        updateCord(step(cord.current, { type: 'pickup' }))
        blade.copy(hand)
      }
    } else {
      droppedVelocity.current = 0
    }

    if (weaponPresent)
      stepVerletRope(
        rope.current,
        delta,
        hand,
        blade,
        cord.current.mode,
        worldConfiguration.sampleHeight,
      )
    if (cord.current.mode === 'Out')
      recordCameraDistanceWhileOut(player.cameraDistance)
    const ropeAttribute = ropeGeometry.getAttribute(
      'position',
    ) as BufferAttribute
    ropeAttribute.needsUpdate = true
    ropeGeometry.setDrawRange(0, rope.current.activePoints)
    ropeObject.visible =
      weaponPresent &&
      (cord.current.mode !== 'InHand' || effectRuntime.pass.mode === 'Passing')
    if (bladeMesh.current) {
      bladeMesh.current.position.copy(blade)
      bladeMesh.current.visible = weaponPresent
    }
    weaponRuntime.tasselVisible = getQuestRuntimeSnapshot().tasselEarned
    if (tasselMesh.current)
      tasselMesh.current.visible = weaponRuntime.tasselVisible
    if (passHighlight.current) {
      const passing = effectRuntime.pass.mode === 'Passing'
      passHighlight.current.visible = passing
      if (passing) {
        const progress =
          1 -
          effectRuntime.pass.remainingSeconds /
            EFFECTS.heelstonePass.durationSeconds
        passHighlight.current.position.copy(hand).lerp(blade, progress)
      }
    }

    const aiming =
      !debugHoldOut.current &&
      inputHeld('aim') &&
      cord.current.mode === 'InHand'
    aimObject.visible = aiming
    if (aiming) {
      const positions = aimPositions.current
      positions[0] = hand.x
      positions[1] = hand.y
      positions[2] = hand.z
      positions[3] = hand.x + aimDirection.x * REACHBLADE.maxCordLength
      positions[4] = hand.y
      positions[5] = hand.z + aimDirection.z * REACHBLADE.maxCordLength
      const attribute = aimGeometry.getAttribute('position') as BufferAttribute
      attribute.needsUpdate = true
    }
  })

  return (
    <>
      <mesh ref={bladeMesh} castShadow rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.7, 4]} />
        <meshStandardMaterial
          color="#687178"
          metalness={0.55}
          roughness={0.5}
        />
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.38, 0]}>
          <torusGeometry args={[0.11, 0.025, 6, 14]} />
          <meshStandardMaterial
            color="#3e4548"
            metalness={0.7}
            roughness={0.4}
          />
        </mesh>
        <mesh ref={tasselMesh} position={TASSEL_REWARD.offset} visible={false}>
          {/* PLACEHOLDER: dyed cloth tassel cosmetic. */}
          <boxGeometry
            args={[
              TASSEL_REWARD.width,
              TASSEL_REWARD.length,
              TASSEL_REWARD.depth,
            ]}
          />
          <meshStandardMaterial
            color={TASSEL_REWARD.color}
            roughness={TASSEL_REWARD.roughness}
          />
        </mesh>
      </mesh>
      <primitive object={ropeObject} />
      <primitive object={aimObject} />
      <mesh ref={passHighlight} visible={false}>
        {/* PLACEHOLDER: moving heelstone-pass highlight. */}
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshBasicMaterial color="#e9efe6" />
      </mesh>
    </>
  )
}
