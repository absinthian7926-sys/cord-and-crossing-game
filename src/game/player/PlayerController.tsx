import { useFrame, useThree } from '@react-three/fiber'
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import { useCallback, useEffect, useRef } from 'react'
import { Group, Vector3, type AnimationClip, type Object3D } from 'three'
import { AUDIO } from '../../data/audio'
import { PLAYER } from '../../data/player'
import { ZONE } from '../../data/zone'
import {
  createAnimationController,
  destroyAnimationController,
  getHeroWeaponAnimationState,
  recordHeroAnimation,
  stepAnimationController,
  type AnimationController,
} from '../animation/animationRuntime'
import {
  createHeroAnimationSelection,
  selectHeroAnimation,
  type HeroAnimationInput,
} from '../animation/heroAnimation'
import { audioBus, emitAudioEvent } from '../audio/audioBus'
import {
  cancelHeelstonePassByDodge,
  clearEffectsOnDeath,
  effectRuntime,
  isHeelstonePassRunning,
} from '../effects/effectRuntime'
import { resetEnemiesNearDeathToReturn } from '../enemies/enemyRuntime'
import {
  createFootstepOutput,
  createFootstepState,
  stepFootsteps,
  type FootstepInput,
} from '../feel/footsteps'
import { getPausableDelta } from '../pause/pauseRuntime'
import { ModelSlot } from '../models/ModelSlot'
import {
  getSceneRuntimeSnapshot,
  getWorldConfiguration,
} from '../scenes/sceneRuntime'
import { resetWeaponToInHand } from '../weapons/weaponRuntime'
import {
  beginPlayerDeath,
  isPlayerInputLocked,
  isPlayerSpawnInvulnerable,
  resetVitalsForRespawn,
  stepPlayerDeath,
} from './death'
import {
  clearInput,
  consumeInput,
  inputHeld,
  isGameplayInputLocked,
} from './input'
import { resolveGroundSpeed } from './movement'
import { playerStore } from './playerStore'
import { spendDodgeStamina, updateVitals } from './vitals'

const input = new Vector3(),
  forward = new Vector3(),
  right = new Vector3(),
  up = new Vector3(0, 1, 0),
  move = new Vector3(),
  dodge = new Vector3(),
  translation = { x: 0, y: 0, z: 0 }

export function PlayerController() {
  const body = useRef<RapierRigidBody>(null),
    collider = useRef<RapierCollider>(null),
    visual = useRef<Group>(null)
  const vertical = useRef(0),
    dodgeLeft = useRef(0),
    cooldown = useRef(0),
    invulnerableLeft = useRef(0),
    unsafeSeconds = useRef(0)
  const animation = useRef<AnimationController | null>(null)
  const animationInput = useRef<HeroAnimationInput>({
    dead: false,
    dodging: false,
    heelstonePassMode: 'Idle',
    heelstonePassRemainingSeconds: 0,
    strikePhase: 'idle',
    comboHitIndex: 1,
    casting: false,
    aiming: false,
    recalling: false,
    grounded: true,
    speedMetersPerSecond: 0,
    running: false,
  })
  const animationSelection = useRef(createHeroAnimationSelection())
  const footstepState = useRef(createFootstepState(true))
  const footstepInput = useRef<FootstepInput>({
    deltaSeconds: 0,
    grounded: true,
    dodging: false,
    paused: false,
    dead: false,
    speedMetersPerSecond: 0,
    scene: 'zone',
    x: 0,
    z: 0,
  })
  const footstepOutput = useRef(createFootstepOutput())
  const { world } = useRapier()
  const character = useRef<ReturnType<
    typeof world.createCharacterController
  > | null>(null)
  const { camera } = useThree()
  const initialPosition = playerStore.getState().position

  const modelReady = useCallback(
    (object: Object3D, clips: readonly AnimationClip[]) => {
      destroyAnimationController(animation.current)
      animation.current = createAnimationController(object, clips)
      const modelBlade = object.getObjectByName('reachblade')
      if (modelBlade) modelBlade.visible = false
    },
    [],
  )

  const stepHeroAnimation = useCallback(
    (
      deltaSeconds: number,
      dead: boolean,
      dodging: boolean,
      grounded: boolean,
      speedMetersPerSecond: number,
      running: boolean,
    ) => {
      const weapon = getHeroWeaponAnimationState()
      const inputState = animationInput.current
      inputState.dead = dead
      inputState.dodging = dodging
      inputState.heelstonePassMode = effectRuntime.pass.mode
      inputState.heelstonePassRemainingSeconds =
        effectRuntime.pass.remainingSeconds
      inputState.strikePhase = weapon.strikePhase
      inputState.comboHitIndex = weapon.comboHitIndex
      inputState.casting = weapon.casting
      inputState.aiming = weapon.aiming
      inputState.recalling = weapon.recalling
      inputState.grounded = grounded
      inputState.speedMetersPerSecond = speedMetersPerSecond
      inputState.running = running
      const selection = selectHeroAnimation(
        inputState,
        animationSelection.current,
      )
      stepAnimationController(
        animation.current,
        selection.clipId,
        deltaSeconds,
        selection.timeScale,
        selection.crossfadeSeconds,
        selection.normalizedTime,
        selection.holdLastPose,
      )
      recordHeroAnimation(
        animation.current,
        selection.clipId,
        selection.timeScale,
      )
    },
    [],
  )

  useEffect(() => {
    const controller = world.createCharacterController(0.01)
    character.current = controller
    playerStore.getState().collider = collider.current
    controller.enableAutostep(0.35, 0.15, true)
    controller.enableSnapToGround(0.2)
    controller.setMaxSlopeClimbAngle(Math.PI / 4)
    controller.setMinSlopeSlideAngle((50 * Math.PI) / 180)
    return () => {
      playerStore.getState().collider = null
      world.removeCharacterController(controller)
      character.current = null
      destroyAnimationController(animation.current)
      animation.current = null
    }
  }, [world])

  useFrame((_, rawDelta) => {
    const controller = character.current
    if (!body.current || !collider.current || !controller) return
    const delta = getPausableDelta(rawDelta)
    if (delta === 0) return
    const store = playerStore.getState()
    if (beginPlayerDeath(store.death, store.vitals.health)) {
      clearInput()
      dodgeLeft.current = 0
      cooldown.current = 0
      invulnerableLeft.current = 0
      vertical.current = 0
      clearEffectsOnDeath()
      resetWeaponToInHand()
      resetEnemiesNearDeathToReturn(store.position.x, store.position.z)
    }
    const respawned = stepPlayerDeath(store.death, delta)
    store.invulnerable =
      isPlayerInputLocked(store.death) ||
      isPlayerSpawnInvulnerable(store.death) ||
      invulnerableLeft.current > 0
    if (respawned) {
      const position = store.position
      const worldConfiguration = getWorldConfiguration()
      resetVitalsForRespawn(store.vitals)
      position.x = worldConfiguration.respawn.x
      position.y =
        worldConfiguration.respawn.y +
        PLAYER.collider.halfHeight +
        PLAYER.collider.radius
      position.z = worldConfiguration.respawn.z
      body.current.setTranslation(position, true)
      body.current.setNextKinematicTranslation(position)
      store.teleportTarget = null
      vertical.current = 0
      unsafeSeconds.current = 0
      footstepState.current.elapsedSeconds = 0
      footstepState.current.wasGrounded = true
      clearInput()
      resetWeaponToInHand()
      stepHeroAnimation(delta, false, false, true, 0, false)
      return
    }
    if (isPlayerInputLocked(store.death)) {
      clearInput()
      stepHeroAnimation(delta, true, false, false, 0, false)
      return
    }
    if (isGameplayInputLocked()) {
      clearInput()
      stepHeroAnimation(
        delta,
        false,
        false,
        controller.computedGrounded(),
        0,
        false,
      )
      return
    }
    const teleportTarget = store.teleportTarget
    if (teleportTarget) {
      store.position.x = teleportTarget.x
      store.position.y = teleportTarget.y
      store.position.z = teleportTarget.z
      body.current.setTranslation(store.position, true)
      body.current.setNextKinematicTranslation(store.position)
      store.teleportTarget = null
      vertical.current = 0
      dodgeLeft.current = 0
      invulnerableLeft.current = 0
      unsafeSeconds.current = 0
      footstepState.current.elapsedSeconds = 0
      footstepState.current.wasGrounded = true
      stepHeroAnimation(delta, false, false, true, 0, false)
      return
    }
    let dodgeCancelledPass = false
    if (isHeelstonePassRunning()) {
      dodgeCancelledPass = consumeInput('dodge')
      if (dodgeCancelledPass) cancelHeelstonePassByDodge()
    }
    if (isHeelstonePassRunning()) {
      vertical.current = 0
      updateVitals(store.vitals, delta, false)
      stepHeroAnimation(
        delta,
        false,
        false,
        controller.computedGrounded(),
        0,
        false,
      )
      return
    }
    dodgeLeft.current = Math.max(0, dodgeLeft.current - delta)
    cooldown.current = Math.max(0, cooldown.current - delta)
    invulnerableLeft.current = Math.max(0, invulnerableLeft.current - delta)
    input.set(
      Number(inputHeld('right')) - Number(inputHeld('left')),
      0,
      Number(inputHeld('backward')) - Number(inputHeld('forward')),
    )
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    right.crossVectors(forward, up).normalize()
    move.copy(right).multiplyScalar(input.x).addScaledVector(forward, -input.z)
    if (move.lengthSq() > 1) move.normalize()

    if (
      (dodgeCancelledPass || consumeInput('dodge')) &&
      cooldown.current <= 0
    ) {
      if (spendDodgeStamina(store.vitals)) {
        if (move.lengthSq() > 0) {
          dodge.copy(move).normalize()
        } else {
          dodge.copy(forward).negate().normalize()
        }
        dodgeLeft.current = PLAYER.movement.dodgeDurationSeconds
        cooldown.current = PLAYER.movement.dodgeCooldownSeconds
        invulnerableLeft.current = PLAYER.movement.dodgeInvulnerabilitySeconds
      }
    }
    if (consumeInput('jump') && controller.computedGrounded())
      vertical.current = Math.sqrt(
        2 * PLAYER.movement.gravity * PLAYER.movement.jumpHeight,
      )
    vertical.current -= PLAYER.movement.gravity * delta
    const dodging = dodgeLeft.current > 0
    const groundSpeed = resolveGroundSpeed(
      inputHeld('run'),
      move.lengthSq() > 0,
      store.vitals,
    )
    const running = groundSpeed === PLAYER.movement.runSpeed
    const speed = dodging
      ? PLAYER.movement.dodgeDistance / PLAYER.movement.dodgeDurationSeconds
      : groundSpeed
    const direction = dodging ? dodge : move
    translation.x = direction.x * speed * delta
    translation.y = vertical.current * delta
    translation.z = direction.z * speed * delta
    controller.computeColliderMovement(collider.current, translation)
    const corrected = controller.computedMovement(),
      current = body.current.translation()
    const position = store.position
    position.x = current.x + corrected.x
    position.y = current.y + corrected.y
    position.z = current.z + corrected.z
    body.current.setNextKinematicTranslation(position)
    const worldConfiguration = getWorldConfiguration()
    const terrainHeight = worldConfiguration.sampleHeight(
      position.x,
      position.z,
    )
    const belowTerrain = position.y < terrainHeight - ZONE.respawn.terrainDrop
    const belowSea =
      worldConfiguration.hasSea &&
      terrainHeight < ZONE.sea.level - ZONE.respawn.seaDepth
    const outsideBounds =
      position.x < worldConfiguration.bounds.minimumX ||
      position.x > worldConfiguration.bounds.maximumX ||
      position.z < worldConfiguration.bounds.minimumZ ||
      position.z > worldConfiguration.bounds.maximumZ
    if (belowTerrain || belowSea || outsideBounds) {
      unsafeSeconds.current += delta
      if (unsafeSeconds.current >= ZONE.respawn.delaySeconds) {
        position.x = worldConfiguration.respawn.x
        position.y =
          worldConfiguration.respawn.y +
          PLAYER.collider.halfHeight +
          PLAYER.collider.radius
        position.z = worldConfiguration.respawn.z
        body.current.setTranslation(position, true)
        body.current.setNextKinematicTranslation(position)
        vertical.current = 0
        unsafeSeconds.current = 0
      }
    } else {
      unsafeSeconds.current = 0
    }
    const grounded = controller.computedGrounded()
    if (grounded && vertical.current < 0) vertical.current = 0
    if (direction.lengthSq() > 0.001 && visual.current)
      visual.current.rotation.y = Math.atan2(direction.x, direction.z)
    updateVitals(store.vitals, delta, running)
    store.invulnerable =
      invulnerableLeft.current > 0 || isPlayerSpawnInvulnerable(store.death)
    const movementSpeed = direction.lengthSq() > 0.001 ? speed : 0
    const stepInput = footstepInput.current
    stepInput.deltaSeconds = delta
    stepInput.grounded = grounded
    stepInput.dodging = dodging
    stepInput.paused = false
    stepInput.dead = false
    stepInput.speedMetersPerSecond = movementSpeed
    stepInput.scene = getSceneRuntimeSnapshot().currentScene
    stepInput.x = position.x
    stepInput.z = position.z
    const audioStep = stepFootsteps(
      footstepState.current,
      stepInput,
      footstepOutput.current,
    )
    if (audioStep.step) {
      const surface =
        audioStep.surface === 'stone'
          ? AUDIO.footsteps.surfaces.stone
          : audioStep.surface === 'wood'
            ? AUDIO.footsteps.surfaces.wood
            : AUDIO.footsteps.surfaces.dirt
      emitAudioEvent(
        audioBus,
        'footstep',
        surface,
        AUDIO.footsteps.gain,
        audioStep.pitch,
      )
    }
    if (audioStep.landing) emitAudioEvent(audioBus, 'landing')
    stepHeroAnimation(delta, false, dodging, grounded, movementSpeed, running)
  })

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      position={[initialPosition.x, initialPosition.y, initialPosition.z]}
      colliders={false}
      name="player"
    >
      <CapsuleCollider
        ref={collider}
        args={[PLAYER.collider.halfHeight, PLAYER.collider.radius]}
      />
      <group ref={visual}>
        <ModelSlot
          model="hero"
          onReady={modelReady}
          fallback={
            <>
              <mesh castShadow position={[0, 0.2, 0]}>
                <capsuleGeometry
                  args={[
                    PLAYER.collider.radius,
                    PLAYER.collider.halfHeight * 2,
                    8,
                    16,
                  ]}
                />
                <meshStandardMaterial color="#61747a" roughness={0.85} />
              </mesh>
              <mesh castShadow position={[0, 0.65, 0.24]}>
                <boxGeometry args={[0.12, 0.18, 0.08]} />
                <meshStandardMaterial color="#b66d45" />
              </mesh>
            </>
          }
        />
      </group>
    </RigidBody>
  )
}
