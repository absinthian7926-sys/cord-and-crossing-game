import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Group, MeshStandardMaterial } from 'three'
import {
  subscribeDummyDamage,
  type DamageLogEntry,
} from '../weapons/weaponRuntime'

type TrainingDummyProps = {
  id: string
  position: readonly [number, number, number]
  cordCutter: boolean
}

export function TrainingDummy({
  id,
  position,
  cordCutter,
}: TrainingDummyProps) {
  const group = useRef<Group>(null)
  const material = useRef<MeshStandardMaterial>(null)
  const damageLabel = useRef<HTMLDivElement>(null)
  const hitAt = useRef(Number.NEGATIVE_INFINITY)
  const staggerUntil = useRef(Number.NEGATIVE_INFINITY)

  useEffect(
    () =>
      subscribeDummyDamage((entry: DamageLogEntry) => {
        if (entry.dummyId !== id) return
        hitAt.current = entry.atSeconds
        staggerUntil.current = entry.atSeconds + entry.staggerSeconds
        if (damageLabel.current) {
          damageLabel.current.textContent = `${entry.damage}`
          damageLabel.current.style.opacity = '1'
        }
      }),
    [id],
  )

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    if (group.current) {
      const staggered = now < staggerUntil.current
      group.current.rotation.z = staggered ? Math.sin(now * 32) * 0.1 : 0
      group.current.position.y = position[1]
    }
    if (material.current) {
      material.current.color.setHex(
        now < staggerUntil.current
          ? 0xc78a62
          : cordCutter
            ? 0x76504b
            : 0x766f62,
      )
    }
    if (damageLabel.current && now - hitAt.current > 0.75) {
      damageLabel.current.style.opacity = '0'
    }
  })

  return (
    <group ref={group} position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.36, 0.48, 1.7, 8]} />
        <meshStandardMaterial ref={material} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshStandardMaterial color="#676157" roughness={0.9} />
      </mesh>
      {cordCutter && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <torusGeometry args={[0.62, 0.06, 6, 20]} />
          <meshStandardMaterial color="#7d3f38" />
        </mesh>
      )}
      <Html center position={[0, 1.65, 0]}>
        <div ref={damageLabel} className="damage-number">
          0
        </div>
      </Html>
    </group>
  )
}
