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
import { consumeInput, inputHeld } from './input'
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
    invulnerableLeft = useRef(0)
  const { world } = useRapier()
  const character = useRef(world.createCharacterController(0.01))
  const { camera } = useThree()

  useEffect(() => {
    const controller = character.current
    controller.enableAutostep(0.35, 0.15, true)
    controller.enableSnapToGround(0.2)
    controller.setMaxSlopeClimbAngle(Math.PI / 4)
    controller.setMinSlopeSlideAngle((50 * Math.PI) / 180)
    return () => world.removeCharacterController(controller)
  }, [world])

  useFrame((_, rawDelta) => {
    if (!body.current || !collider.current) return
    const delta = Math.min(rawDelta, 1 / 30)
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

    const store = playerStore.getState()
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
    if (consumeInput('jump') && character.current.computedGrounded())
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
    character.current.computeColliderMovement(collider.current, translation)
    const corrected = character.current.computedMovement(),
      current = body.current.translation()
    const position = store.position
    position.x = current.x + corrected.x
    position.y = current.y + corrected.y
    position.z = current.z + corrected.z
    body.current.setNextKinematicTranslation(position)
    if (character.current.computedGrounded() && vertical.current < 0)
      vertical.current = 0
    if (direction.lengthSq() > 0.001 && visual.current)
      visual.current.rotation.y = Math.atan2(direction.x, direction.z)
    updateVitals(store.vitals, delta, running)
    store.invulnerable = invulnerableLeft.current > 0
  })

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      position={[0, 1.3, 0]}
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
