import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  Vector3,
} from 'three'
import { REACHBLADE, TRAINING_DUMMIES } from '../../data/weapons'
import {
  initialComboState,
  isTargetInArc,
  selectFlatArcTargets,
  shoveDamage,
  tryStartCloseAttack,
  type CloseAttack,
} from '../combat/combat'
import { capsuleOverlapsPoint } from '../combat/hitboxes'
import {
  consumeInput,
  consumeReleased,
  inputHeld,
  isDoubleTap,
} from '../player/input'
import { playerStore } from '../player/playerStore'
import { spendStamina } from '../player/vitals'
import {
  canCloseStrike,
  canCordBeCut,
  initialCordState,
  step,
  type CordState,
} from './cordState'
import {
  registerForceCut,
  recordDummyDamage,
  resetWeaponRuntime,
  setCordState,
} from './weaponRuntime'
import { createVerletRope, stepVerletRope } from './verletRope'

type PendingAction =
  | { kind: 'close'; remaining: number; attack: CloseAttack }
  | { kind: 'cast' | 'arc'; remaining: number; x: number; z: number }

const hand = new Vector3()
const blade = new Vector3(0, 1.35, 0)
const aimDirection = new Vector3(0, 0, -1)
const castDirection = new Vector3(0, 0, -1)
const toHand = new Vector3()
const arcTargets = TRAINING_DUMMIES.map((dummy) => ({
  id: dummy.id,
  x: dummy.position[0],
  z: dummy.position[2],
}))

export function CordWeapon() {
  const { camera } = useThree()
  const bladeMesh = useRef<Mesh>(null)
  const cord = useRef<CordState>(initialCordState())
  const combo = useRef(initialComboState())
  const pending = useRef<PendingAction | null>(null)
  const lastQTap = useRef(Number.NEGATIVE_INFINITY)
  const skipAimRelease = useRef(false)
  const closeActiveRemaining = useRef(0)
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

  const updateCord = (next: CordState) => {
    cord.current = next
    setCordState(next)
  }

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
  ) => {
    const position = playerStore.getState().position
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

  useEffect(() => {
    resetWeaponRuntime()
    setCordState(cord.current)
    registerForceCut(() => {
      updateCord(step(cord.current, { type: 'cut' }))
    })
    return () => {
      registerForceCut(null)
      ropeGeometry.dispose()
      aimGeometry.dispose()
      ;(ropeObject.material as LineBasicMaterial).dispose()
      ;(aimObject.material as LineBasicMaterial).dispose()
    }
  }, [aimGeometry, aimObject, ropeGeometry, ropeObject])

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30)
    closeActiveRemaining.current = Math.max(
      0,
      closeActiveRemaining.current - delta,
    )
    const now = clock.elapsedTime
    const player = playerStore.getState()
    camera.getWorldDirection(aimDirection)
    aimDirection.y = 0
    aimDirection.normalize()
    hand.set(
      player.position.x + 0.28,
      player.position.y + 0.45,
      player.position.z,
    )

    if (consumeInput('recall')) {
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

    const closePressed = consumeInput('closeStrike')
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
        )
      }
    }

    if (consumeReleased('aim')) {
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
          closeActiveRemaining.current = action.attack.activeSeconds
          strikeNearest(
            action.attack.damage,
            REACHBLADE.close.arcDegrees,
            REACHBLADE.close.reach,
            now,
          )
        } else {
          castDirection.set(action.x, 0, action.z).normalize()
          blade.copy(hand)
          if (action.kind === 'cast') {
            updateCord(step(cord.current, { type: 'castRelease' }))
          } else {
            updateCord(step(cord.current, { type: 'arcRelease' }))
            blade.addScaledVector(
              castDirection,
              (REACHBLADE.flatArc.minimumRadius +
                REACHBLADE.flatArc.maximumRadius) /
                2,
            )
            const selected = selectFlatArcTargets(
              arcTargets,
              player.position.x,
              player.position.z,
              castDirection.x,
              castDirection.z,
            )
            for (const target of selected) {
              damageDummy(
                target.id,
                REACHBLADE.flatArc.damage,
                REACHBLADE.cast.staggerSeconds,
                now,
              )
            }
            updateCord(step(cord.current, { type: 'hit' }))
          }
        }
      }
    }

    if (cord.current.mode === 'InHand') {
      blade.copy(hand).addScaledVector(aimDirection, 0.3)
    } else if (cord.current.mode === 'Out') {
      blade.addScaledVector(castDirection, REACHBLADE.cast.travelSpeed * delta)
      const distance = blade.distanceTo(hand)
      let hitDummy = false
      for (const dummy of TRAINING_DUMMIES) {
        const dx = blade.x - dummy.position[0]
        const dy = blade.y - dummy.position[1]
        const dz = blade.z - dummy.position[2]
        if (dx * dx + dy * dy + dz * dz <= REACHBLADE.bladeHitRadius ** 2) {
          damageDummy(
            dummy.id,
            REACHBLADE.cast.damage,
            REACHBLADE.cast.staggerSeconds,
            now,
          )
          updateCord(step(cord.current, { type: 'hit' }))
          hitDummy = true
          break
        }
      }
      if (!hitDummy && distance >= REACHBLADE.maxCordLength) {
        blade
          .copy(hand)
          .addScaledVector(castDirection, REACHBLADE.maxCordLength)
        updateCord(step(cord.current, { type: 'maxRange' }))
      }
    }

    if (cord.current.mode === 'Out' || cord.current.mode === 'Returning') {
      for (const dummy of TRAINING_DUMMIES) {
        if (
          dummy.cordCutter &&
          capsuleOverlapsPoint(
            dummy.position[0],
            dummy.position[1],
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
      updateCord(step(cord.current, { type: 'tick' }, delta))
      if (cord.current.retieRemaining <= 0) {
        updateCord(step(cord.current, { type: 'retieDone' }))
        blade.copy(hand)
      }
    } else if (cord.current.mode === 'Dropped') {
      if (blade.distanceTo(player.position) <= REACHBLADE.stop.pickupRadius) {
        updateCord(step(cord.current, { type: 'pickup' }))
        blade.copy(hand)
      }
    }

    stepVerletRope(rope.current, delta, hand, blade, cord.current.mode)
    const ropeAttribute = ropeGeometry.getAttribute(
      'position',
    ) as BufferAttribute
    ropeAttribute.needsUpdate = true
    ropeGeometry.setDrawRange(0, rope.current.activePoints)
    ropeObject.visible = cord.current.mode !== 'InHand'
    if (bladeMesh.current) bladeMesh.current.position.copy(blade)

    const aiming = inputHeld('aim') && cord.current.mode === 'InHand'
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
      </mesh>
      <primitive object={ropeObject} />
      <primitive object={aimObject} />
    </>
  )
}
