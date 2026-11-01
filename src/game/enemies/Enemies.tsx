import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { InstancedMesh, Object3D } from 'three'
import { ENEMY_ARROW } from '../../data/enemies'
import { PLAYER } from '../../data/player'
import { applyCombatDamage } from '../combat/combat'
import { playerStore } from '../player/playerStore'
import { isUnarmed } from '../weapons/cordState'
import { weaponRuntime } from '../weapons/weaponRuntime'
import { heightAt } from '../world/terrain'
import { Enemy } from './Enemy'
import {
  enemyRuntime,
  initializeEnemyRoster,
  subscribeEnemyRoster,
} from './enemyRuntime'
import { stepArrows } from './projectiles'
import { createSpawnPlan } from './spawns'

function initializeDefaultRoster(): void {
  if (enemyRuntime.records.length > 0) return
  const spawnPlan = createSpawnPlan()
  initializeEnemyRoster(
    spawnPlan.map((spawn) => ({
      id: spawn.id,
      type: spawn.enemyType,
      x: spawn.x,
      z: spawn.z,
      anchorX: spawn.anchorX,
      anchorZ: spawn.anchorZ,
      patrolStartX: spawn.patrolStartX,
      patrolStartZ: spawn.patrolStartZ,
      patrolEndX: spawn.patrolEndX,
      patrolEndZ: spawn.patrolEndZ,
    })),
  )
}

function EnemyProjectiles() {
  const mesh = useRef<InstancedMesh>(null)
  const transform = useMemo(() => new Object3D(), [])

  useFrame((_, rawDelta) => {
    const arrows = enemyRuntime.arrows
    const player = playerStore.getState()
    const damage = stepArrows(
      arrows,
      Math.min(rawDelta, 1 / 30),
      player.position.x,
      player.position.y,
      player.position.z,
      PLAYER.collider.radius,
      player.invulnerable,
      heightAt,
    )
    if (damage > 0)
      applyCombatDamage(
        player.vitals,
        damage,
        isUnarmed(weaponRuntime.cord),
        player.invulnerable,
      )

    const arrowsMesh = mesh.current
    if (!arrowsMesh) return
    for (let index = 0; index < arrows.active.length; index += 1) {
      if (arrows.active[index] === 0) {
        transform.position.set(0, -1000, 0)
        transform.scale.setScalar(0)
      } else {
        transform.position.set(
          arrows.x[index],
          arrows.y[index],
          arrows.z[index],
        )
        transform.scale.setScalar(1)
        const horizontalSpeed = Math.hypot(
          arrows.velocityX[index],
          arrows.velocityZ[index],
        )
        transform.rotation.set(
          -Math.atan2(arrows.velocityY[index], horizontalSpeed),
          Math.atan2(arrows.velocityX[index], arrows.velocityZ[index]),
          0,
        )
      }
      transform.updateMatrix()
      arrowsMesh.setMatrixAt(index, transform.matrix)
    }
    arrowsMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, ENEMY_ARROW.poolSize]}
      frustumCulled={false}
    >
      <boxGeometry args={[0.025, 0.025, 0.65]} />
      <meshStandardMaterial color="#5e4b35" roughness={0.9} />
    </instancedMesh>
  )
}

export function Enemies() {
  const [, rerender] = useReducer((value: number) => value + 1, 0)

  useEffect(() => {
    const unsubscribe = subscribeEnemyRoster(rerender)
    initializeDefaultRoster()
    return unsubscribe
  }, [])

  return (
    <>
      {enemyRuntime.records.map((enemy) => (
        <Enemy key={enemy.id} enemy={enemy} />
      ))}
      <EnemyProjectiles />
    </>
  )
}
