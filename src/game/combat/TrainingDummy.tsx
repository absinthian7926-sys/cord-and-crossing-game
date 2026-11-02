import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Group, MeshStandardMaterial } from 'three'
import { AUDIO } from '../../data/audio'
import { FEEL } from '../../data/feel'
import { REACHBLADE } from '../../data/weapons'
import { audioBus, emitAudioEvent } from '../audio/audioBus'
import {
  createEnemyFlashState,
  stepEnemyHitFlash,
  triggerEnemyHitFlash,
} from '../feel/hitFlash'
import { recordEnemyHitFlash } from '../feel/feelRuntime'
import {
  getPausableDelta,
  getPauseRuntimeSnapshot,
} from '../pause/pauseRuntime'
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
  const hitFlash = useRef(createEnemyFlashState())
  const baseColor = useMemo(
    () => new Color(cordCutter ? 0x76504b : 0x766f62),
    [cordCutter],
  )
  const flashColor = useMemo(() => new Color(FEEL.hitFlash.enemy.color), [])

  useEffect(
    () =>
      subscribeDummyDamage((entry: DamageLogEntry) => {
        if (entry.dummyId !== id) return
        if (entry.damage > 0) {
          emitAudioEvent(
            audioBus,
            'hit-flesh',
            0,
            entry.damage === REACHBLADE.close.damage[2]
              ? AUDIO.hits.strikeThreeGainMultiplier
              : 1,
          )
          triggerEnemyHitFlash(hitFlash.current, false)
          recordEnemyHitFlash()
        }
        hitAt.current = entry.atSeconds
        staggerUntil.current = entry.atSeconds + entry.staggerSeconds
        if (damageLabel.current) {
          damageLabel.current.textContent = `${entry.damage}`
          damageLabel.current.style.opacity = '1'
        }
      }),
    [id],
  )

  useFrame((_, rawDeltaSeconds) => {
    const deltaSeconds = getPausableDelta(rawDeltaSeconds)
    const now = getPauseRuntimeSnapshot().elapsedSeconds
    if (group.current) {
      const staggered = now < staggerUntil.current
      group.current.rotation.z = staggered ? Math.sin(now * 32) * 0.1 : 0
      group.current.position.y = position[1]
    }
    if (material.current) {
      const staggered = now < staggerUntil.current
      const flashMix = stepEnemyHitFlash(
        hitFlash.current,
        deltaSeconds,
        staggered,
      )
      if (staggered) material.current.color.setHex(0xc78a62)
      else material.current.color.copy(baseColor)
      if (!staggered && flashMix > 0)
        material.current.color.lerp(flashColor, flashMix)
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
