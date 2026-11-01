import { useFrame, useThree } from '@react-three/fiber'
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Group, Vector3 } from 'three'
import { PLAYER } from '../../data/player'
import { ZONE } from '../../data/zone'
import { resetEnemiesToReturn } from '../enemies/enemyRuntime'
import { resetWeaponToInHand } from '../weapons/weaponRuntime'
import { heightAt } from '../world/terrain'
import {
  beginPlayerDeath,
  isPlayerInputLocked,
  isPlayerSpawnInvulnerable,
  resetVitalsForRespawn,
  stepPlayerDeath,
  WAYSTATION_RESPAWN,
} from './death'
import { clearInput, consumeInput, inputHeld } from './input'
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
  const { world } = useRapier()
  const character = useRef<ReturnType<
    typeof world.createCharacterController
  > | null>(null)
  const { camera } = useThree()

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
    }
  }, [world])

  useFrame((_, rawDelta) => {
    const controller = character.current
    if (!body.current || !collider.current || !controller) return
    const delta = Math.min(rawDelta, 1 / 30)
    const store = playerStore.getState()
    if (beginPlayerDeath(store.death, store.vitals.health)) {
      clearInput()
      dodgeLeft.current = 0
      cooldown.current = 0
      invulnerableLeft.current = 0
      vertical.current = 0
      resetWeaponToInHand()
      resetEnemiesToReturn()
    }
    const respawned = stepPlayerDeath(store.death, delta)
    store.invulnerable =
      isPlayerInputLocked(store.death) ||
      isPlayerSpawnInvulnerable(store.death) ||
      invulnerableLeft.current > 0
    if (respawned) {
      const position = store.position
      resetVitalsForRespawn(store.vitals)
      position.x = WAYSTATION_RESPAWN.x
      position.y =
        WAYSTATION_RESPAWN.y +
        PLAYER.collider.halfHeight +
        PLAYER.collider.radius
      position.z = WAYSTATION_RESPAWN.z
      body.current.setTranslation(position, true)
      body.current.setNextKinematicTranslation(position)
      store.teleportTarget = null
      vertical.current = 0
      unsafeSeconds.current = 0
      clearInput()
      resetWeaponToInHand()
      return
    }
    if (isPlayerInputLocked(store.death)) {
      clearInput()
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
      unsafeSeconds.current = 0
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

    if (consumeInput('dodge') && cooldown.current <= 0) {
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
    const belowTerrain =
      position.y < heightAt(position.x, position.z) - ZONE.respawn.terrainDrop
    const belowSea =
      heightAt(position.x, position.z) < ZONE.sea.level - ZONE.respawn.seaDepth
    const outsideBounds =
      position.x < ZONE.bounds.minimumX ||
      position.x > ZONE.bounds.maximumX ||
      position.z < ZONE.bounds.minimumZ ||
      position.z > ZONE.bounds.maximumZ
    if (belowTerrain || belowSea || outsideBounds) {
      unsafeSeconds.current += delta
      if (unsafeSeconds.current >= ZONE.respawn.delaySeconds) {
        position.x = ZONE.spawn[0]
        position.y =
          ZONE.spawn[1] + PLAYER.collider.halfHeight + PLAYER.collider.radius
        position.z = ZONE.spawn[2]
        body.current.setTranslation(position, true)
        body.current.setNextKinematicTranslation(position)
        vertical.current = 0
        unsafeSeconds.current = 0
      }
    } else {
      unsafeSeconds.current = 0
    }
    if (controller.computedGrounded() && vertical.current < 0)
      vertical.current = 0
    if (direction.lengthSq() > 0.001 && visual.current)
      visual.current.rotation.y = Math.atan2(direction.x, direction.z)
    updateVitals(store.vitals, delta, running)
    store.invulnerable =
      invulnerableLeft.current > 0 || isPlayerSpawnInvulnerable(store.death)
  })

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      position={[
        ZONE.spawn[0],
        ZONE.spawn[1] + PLAYER.collider.halfHeight + PLAYER.collider.radius,
        ZONE.spawn[2],
      ]}
      colliders={false}
      name="player"
    >
      <CapsuleCollider
        ref={collider}
        args={[PLAYER.collider.halfHeight, PLAYER.collider.radius]}
      />
      <group ref={visual}>
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
      </group>
    </RigidBody>
  )
}
